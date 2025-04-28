import { useEffect, useRef, useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import { SipEndpoint } from "react-native-pjsip";
import InCallManager from "react-native-incall-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNCallKeep from "react-native-callkeep";
import uuid from "react-native-uuid";
import {
  useSipStore,
  SipConfig,
  ConnectionStatus,
  CallInfo,
  sipConfigSchema,
} from "../store/sipStore";

function getCallStateText(state: string): string {
  switch (state) {
    case "PJSIP_INV_STATE_NULL":
      return "Nulo";
    case "PJSIP_INV_STATE_CALLING":
      return "Chamando...";
    case "PJSIP_INV_STATE_INCOMING":
      return "Recebendo Chamada";
    case "PJSIP_INV_STATE_EARLY":
      return "Estabelecendo (Early)";
    case "PJSIP_INV_STATE_CONNECTING":
      return "Conectando...";
    case "PJSIP_INV_STATE_CONFIRMED":
      return "Conectado";
    case "PJSIP_INV_STATE_DISCONNECTED":
      return "Desconectado";
    default:
      return state;
  }
}

interface PjSipManagerHook {
  makeCall: (destination: string) => Promise<void>;
  hangupCall: (pjsipCallIdToHangup?: string) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  toggleSpeaker: () => void;
  isSpeakerOn: boolean;
}

const ASYNC_STORAGE_SIP_CONFIG_KEY = "sipConfig";

export function usePjSipManager(): PjSipManagerHook {
  const { sipConfig, setConnectionStatus, setActiveCall, setSipConfig } =
    useSipStore((state) => ({
      sipConfig: state.sipConfig,
      setConnectionStatus: state.setConnectionStatus,
      setActiveCall: state.setActiveCall,
      setSipConfig: state.setSipConfig,
    }));

  const endpointRef = useRef<any | null>(null);
  const accountRef = useRef<any | null>(null);
  const callInstancesRef = useRef<Record<string, any>>({});
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const callKeepMappings = useRef<Record<string, string>>({});

  const clearActiveCall = useCallback(
    (pjsipCallId?: string) => {
      const activeCallState = useSipStore.getState().activeCall;
      const callIdToClear = pjsipCallId || activeCallState?.id;
      if (!callIdToClear) {
        console.log("clearActiveCall: Nenhum ID de chamada para limpar.");
        return;
      }

      console.log(`Limpando chamada ativa PJSIP ID: ${callIdToClear}`);

      const callKeepUUID = callKeepMappings.current[callIdToClear];
      if (callKeepUUID) {
        console.log(`Encerrando chamada CallKeep UUID: ${callKeepUUID}`);
        RNCallKeep.endCall(callKeepUUID);
        const newMappings = { ...callKeepMappings.current };
        delete newMappings[callIdToClear];
        callKeepMappings.current = newMappings;
      } else {
        console.log(
          "Nenhum mapeamento CallKeep encontrado para PJSIP ID:",
          callIdToClear
        );
      }

      const callInstance = callInstancesRef.current[callIdToClear];
      if (callInstance) {
        try {
          console.log(
            "Removendo listeners da instância PJSIP ID:",
            callIdToClear
          );
          callInstance.removeAllListeners();
        } catch (e) {
          console.warn("Erro ao remover listeners:", e);
        }
        delete callInstancesRef.current[callIdToClear];
        console.log("Instância PJSIP removida do mapa.");
      } else {
        console.warn(
          "Instância PJSIP não encontrada no mapa para ID:",
          callIdToClear
        );
      }

      if (activeCallState?.id === callIdToClear) {
        setActiveCall(null);
      }

      console.log("Parando InCallManager e Ringtone (clearActiveCall)");
      InCallManager.stopRingtone();
      InCallManager.stop();
      setIsSpeakerOn(false);
    },
    [setActiveCall]
  );

  const updateStatus = useCallback(
    (status: ConnectionStatus) => {
      setConnectionStatus(status);
    },
    [setConnectionStatus]
  );

  const attachCallListeners = useCallback(
    (call: any) => {
      const pjsipCallId = call.getId();
      console.log("Anexando listeners para chamada PJSIP ID:", pjsipCallId);
      call.removeAllListeners();

      call.addListener("on_call_state", (newState: string, reason: any) => {
        console.log(
          `PJSIP State Changed: ID=${pjsipCallId}, State=${newState}, Reason=${reason}`
        );
        const callInfo = call.getInfo();
        const stateText = getCallStateText(newState);
        const isIncomingCall =
          callInfo.isIncoming === true || callInfo.role === "UAS";
        const updatedCallInfo: CallInfo = {
          id: pjsipCallId,
          remoteUri: callInfo.remoteUri,
          state: newState,
          stateText: stateText,
        };
        setActiveCall(updatedCallInfo);

        const callKeepUUID = callKeepMappings.current[pjsipCallId];
        if (!callKeepUUID) {
          console.warn(
            "CallKeep UUID não encontrado para PJSIP ID:",
            pjsipCallId
          );
          if (newState === "PJSIP_INV_STATE_DISCONNECTED") {
            clearActiveCall(pjsipCallId);
          }
          return;
        }

        if (newState === "PJSIP_INV_STATE_CONFIRMED") {
          console.log(
            "Chamada confirmada, iniciando InCallManager e reportando ao CallKeep..."
          );
          if (!isIncomingCall) {
            RNCallKeep.reportConnectedOutgoingCallWithUUID(callKeepUUID);
          }
          InCallManager.start({ media: "audio" });
        } else if (newState === "PJSIP_INV_STATE_DISCONNECTED") {
          console.log(
            `Chamada PJSIP ${pjsipCallId} desconectada (evento on_call_state).`
          );
          clearActiveCall(pjsipCallId);
        }
      });

      call.addListener("on_call_media_state", (mediaInfo: any) => {
        console.log(`Call Media State Changed: ID=${pjsipCallId}`, mediaInfo);
      });
    },
    [setActiveCall, clearActiveCall]
  );

  const hangupCall = useCallback(
    async (pjsipCallIdToHangup?: string) => {
      const activeCallState = useSipStore.getState().activeCall;
      const callId = pjsipCallIdToHangup || activeCallState?.id;
      if (!callId) {
        console.log("hangupCall: Nenhum ID de chamada para desligar.");
        return;
      }
      console.log(`Tentando desligar/cancelar chamada PJSIP ID: ${callId}`);
      InCallManager.stopRingtone();

      const callToHangup = callInstancesRef.current[callId];

      if (!callToHangup) {
        console.warn(
          "Instância da chamada PJSIP não encontrada para desligar/cancelar ID:",
          callId
        );
        clearActiveCall(callId);
        return;
      }

      try {
        await callToHangup.hangup();
        console.log("Comando hangup enviado para chamada PJSIP ID:", callId);
      } catch (error) {
        console.error("Erro ao desligar chamada PJSIP ID:", callId, error);
        Alert.alert(
          "Erro",
          `Falha ao desligar: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        clearActiveCall(callId);
      }
    },
    [clearActiveCall]
  );

  const answerCall = useCallback(async () => {
    const activeCallState = useSipStore.getState().activeCall;
    const callId = activeCallState?.id;
    if (!callId) {
      console.log("answerCall: Nenhum ID de chamada para atender.");
      return;
    }
    const callToAnswer = callInstancesRef.current[callId];
    if (!callToAnswer) {
      Alert.alert("Erro", "Instância da chamada para atender não encontrada.");
      clearActiveCall(callId);
      return;
    }
    try {
      await callToAnswer.answer(200);
    } catch (error) {
      console.error("Erro ao atender chamada:", error);
      clearActiveCall(callId);
    }
  }, [clearActiveCall]);

  const declineCall = useCallback(async () => {
    const activeCallState = useSipStore.getState().activeCall;
    const callId = activeCallState?.id;
    if (!callId) {
      console.log("declineCall: Nenhum ID de chamada para rejeitar.");
      return;
    }
    const callToDecline = callInstancesRef.current[callId];
    if (!callToDecline) {
      Alert.alert("Erro", "Instância da chamada para rejeitar não encontrada.");
      clearActiveCall(callId);
      return;
    }
    try {
      await callToDecline.hangup({ statusCode: 603 });
    } catch (error) {
      console.error("Erro ao rejeitar chamada:", error);
      clearActiveCall(callId);
    }
  }, [clearActiveCall]);

  const toggleSpeaker = useCallback(() => {
    const nextSpeakerState = !isSpeakerOn;
    console.log(`Alternando speaker para: ${nextSpeakerState ? "ON" : "OFF"}`);
    InCallManager.setSpeakerphoneOn(nextSpeakerState);
    if (Platform.OS === "ios") {
      InCallManager.setForceSpeakerphoneOn(nextSpeakerState);
    }
    setIsSpeakerOn(nextSpeakerState);
  }, [isSpeakerOn]);

  const makeCall = useCallback(
    async (destination: string) => {
      let callKeepUUID: string | undefined = undefined;
      try {
        const targetUri = `sip:${destination}@${sipConfig?.server}`;
        console.log(`Realizando chamada para ${targetUri}...`);

        callKeepUUID = uuid.v4() as string;
        const pjsipCallIdProvisorio = `outgoing-${callKeepUUID}`;

        console.log(`Iniciando chamada CallKeep UUID: ${callKeepUUID}`);
        RNCallKeep.startCall(
          callKeepUUID,
          destination,
          destination,
          "number",
          false
        );

        const call = await accountRef.current.makeCall(targetUri);
        const pjsipCallIdReal = call.getId();
        callInstancesRef.current[pjsipCallIdReal] = call;
        console.log(
          `Instância PJSIP ID: ${pjsipCallIdReal} adicionada ao mapa.`
        );

        callKeepMappings.current = {
          ...callKeepMappings.current,
          [pjsipCallIdReal]: callKeepUUID,
        };
        console.log(
          `Mapeamento criado: PJSIP ${pjsipCallIdReal} -> CallKeep ${callKeepUUID}`
        );

        attachCallListeners(call);

        const initialCallInfo: CallInfo = {
          id: pjsipCallIdReal,
          remoteUri: targetUri,
          state: "PJSIP_INV_STATE_CALLING",
          stateText: getCallStateText("PJSIP_INV_STATE_CALLING"),
        };
        setActiveCall(initialCallInfo);
      } catch (error) {
        console.error("Erro ao realizar chamada:", error);
        Alert.alert(
          "Erro na Chamada",
          `Falha ao iniciar: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        if (callKeepUUID) {
          RNCallKeep.endCall(callKeepUUID);
        }
        const activeCallStateOnError = useSipStore.getState().activeCall;
        clearActiveCall(activeCallStateOnError?.id);
      }
    },
    [sipConfig, setActiveCall, clearActiveCall, attachCallListeners, hangupCall]
  );

  const setupCallKeep = useCallback(() => {
    console.log("Configurando RNCallKeep...");
    try {
      RNCallKeep.setup({
        ios: {
          appName: "SipNativeDemo",
        },
        android: {
          alertTitle: "Permissions required",
          alertDescription:
            "This application needs to access your phone accounts",
          cancelButton: "Cancel",
          okButton: "Ok",
          additionalPermissions: [],
          foregroundService: {
            channelId: "com.sipnativedemo.callkeep",
            channelName: "Foreground service for SIP calls",
            notificationTitle: "SIP Call in progress",
          },
        },
      });
      RNCallKeep.setAvailable(true);
      console.log("RNCallKeep configurado.");
    } catch (err: any) {
      console.error("Erro ao configurar RNCallKeep:", err.message);
    }

    RNCallKeep.addEventListener("answerCall", ({ callUUID }) => {
      console.log(`[RNCallKeep] answerCall: ${callUUID}`);
      const pjsipCallId = Object.keys(callKeepMappings.current).find(
        (key) => callKeepMappings.current[key] === callUUID
      );
      if (pjsipCallId && callInstancesRef.current[pjsipCallId]) {
        answerCall();
      } else {
        console.warn(
          "[RNCallKeep] answerCall: Chamada PJSIP não encontrada para UUID:",
          callUUID
        );
      }
    });

    RNCallKeep.addEventListener("endCall", ({ callUUID }) => {
      console.log(`[RNCallKeep] endCall: ${callUUID}`);
      const pjsipCallId = Object.keys(callKeepMappings.current).find(
        (key) => callKeepMappings.current[key] === callUUID
      );
      if (pjsipCallId) {
        hangupCall(pjsipCallId);
      } else {
        console.warn(
          "[RNCallKeep] endCall: Chamada PJSIP não encontrada para UUID:",
          callUUID
        );
        RNCallKeep.endCall(callUUID);
      }
    });

    return () => {
      console.log("Limpando listeners RNCallKeep...");
      RNCallKeep.removeEventListener("answerCall");
      RNCallKeep.removeEventListener("endCall");
    };
  }, [answerCall, hangupCall]);

  useEffect(() => {
    const cleanupCallKeep = setupCallKeep();
    return cleanupCallKeep;
  }, [setupCallKeep]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const storedConfigJson = await AsyncStorage.getItem(
          ASYNC_STORAGE_SIP_CONFIG_KEY
        );
        if (storedConfigJson) {
          console.log(
            "Configuração SIP encontrada no AsyncStorage, carregando..."
          );
          const storedConfig = JSON.parse(storedConfigJson);
          const validation = sipConfigSchema.safeParse(storedConfig);
          if (validation.success) {
            setSipConfig(validation.data);
          } else {
            console.warn(
              "Configuração SIP armazenada inválida:",
              validation.error.flatten()
            );
            await AsyncStorage.removeItem(ASYNC_STORAGE_SIP_CONFIG_KEY);
          }
        } else {
          console.log("Nenhuma configuração SIP encontrada no AsyncStorage.");
        }
      } catch (error) {
        console.error(
          "Erro ao carregar configuração SIP do AsyncStorage:",
          error
        );
      }
    };

    if (!sipConfig) {
      loadConfig();
    }
  }, []);

  useEffect(() => {
    const initializeAndRegister = async (config: SipConfig) => {
      if (endpointRef.current || accountRef.current) {
        console.log("PJSIP já inicializado, limpando antes de reconfigurar...");
        await clearActiveCall();
      }

      try {
        updateStatus("Configurando");
        console.log("Inicializando PJSIP...");

        const endpoint = new SipEndpoint();
        endpointRef.current = endpoint;
        await endpoint.start();
        console.log("PJSIP Endpoint iniciado.");

        endpoint.addListener(
          "on_reg_state",
          (accId: any, accUri: any, code: any, reason: any) => {
            console.log(
              `Endpoint RegState: ${accId}, ${accUri}, Code: ${code}, Reason: ${reason}`
            );
          }
        );

        const accountConfig = {
          uri: `sip:${config.username}@${config.server}`,
          registrar: `sip:${config.server}`,
          transport: "UDP",
          auth_user: config.username,
          auth_pass: config.password,
        };

        console.log("Configurando conta SIP:", accountConfig.uri);
        const account = await endpoint.createAccount(accountConfig);
        accountRef.current = account;
        console.log("Conta SIP criada, ID:", account.getId());

        account.addListener(
          "on_reg_state",
          (status: any, reason: any, code: any) => {
            console.log(
              `Account RegState: Status=${status}, Reason=${reason}, Code=${code}`
            );
            if (status === "registered") {
              updateStatus("Registrado");
            } else if (status === "unregistered") {
              updateStatus("Não Registrado");
            } else if (status === "failed" || code >= 400) {
              updateStatus("Erro");
              Alert.alert(
                "Erro de Registro SIP",
                `Falha ao registrar: ${reason} (Código: ${code})`
              );
            } else {
              updateStatus("Conectando");
            }
          }
        );

        account.addListener("on_incoming_call", async (call: any) => {
          const pjsipCallId = call.getId();
          const remoteUri = call.getInfo().remoteUri;
          console.log(`Chamada Recebida: ID=${pjsipCallId}, from=${remoteUri}`);

          if (Object.keys(callInstancesRef.current).length > 0) {
            console.warn(
              "Rejeitando chamada recebida, já existe uma ativa (verificando mapa)."
            );
            try {
              await call.hangup({ statusCode: 486 });
            } catch (e) {
              console.error("Erro ao rejeitar chamada recebida (ocupado):", e);
            }
            return;
          }

          const callKeepUUID = uuid.v4() as string;
          callKeepMappings.current = {
            ...callKeepMappings.current,
            [pjsipCallId]: callKeepUUID,
          };
          console.log(
            `Mapeamento criado: PJSIP ${pjsipCallId} -> CallKeep ${callKeepUUID}`
          );

          callInstancesRef.current[pjsipCallId] = call;
          console.log(
            `Instância PJSIP ID: ${pjsipCallId} adicionada ao mapa (incoming).`
          );

          attachCallListeners(call);

          const incomingCallInfo: CallInfo = {
            id: pjsipCallId,
            remoteUri: remoteUri,
            state: "PJSIP_INV_STATE_INCOMING",
            stateText: getCallStateText("PJSIP_INV_STATE_INCOMING"),
          };
          setActiveCall(incomingCallInfo);

          console.log("Exibindo chamada recebida no CallKeep...");
          RNCallKeep.displayIncomingCall(
            callKeepUUID,
            remoteUri,
            remoteUri,
            "number",
            true
          );
        });
      } catch (error) {
        console.error("Erro ao inicializar PJSIP:", error);
        const activeCallStateOnError = useSipStore.getState().activeCall;
        clearActiveCall(activeCallStateOnError?.id);
      }
    };

    if (sipConfig) {
      initializeAndRegister(sipConfig);
    } else {
      clearActiveCall();
    }

    return () => {
      if (sipConfig) {
        clearActiveCall();
      }
    };
  }, [
    sipConfig,
    clearActiveCall,
    updateStatus,
    setActiveCall,
    attachCallListeners,
  ]);

  return {
    makeCall,
    hangupCall,
    answerCall,
    declineCall,
    toggleSpeaker,
    isSpeakerOn,
  };
}
