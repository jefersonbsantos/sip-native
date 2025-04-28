import { useEffect, useRef, useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import PjSip, { SipEndpoint, SipAccount, SipCall } from "react-native-pjsip";
import InCallManager from "react-native-incall-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNCallKeep, { CONSTANTS as CK_CONSTANTS } from "react-native-callkeep";
import uuid from "react-native-uuid";
import {
  useSipStore,
  SipConfig,
  ConnectionStatus,
  CallInfo,
  sipConfigSchema,
} from "../store/sipStore";

// Função para mapear estados PJSIP para texto legível
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
      return state; // Retorna o estado original se não mapeado
  }
}

// Definir o tipo de retorno do Hook
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

  // Usar useRef para manter referências ao endpoint e account sem causar re-renderizações
  const endpointRef = useRef<any | null>(null);
  const accountRef = useRef<any | null>(null);
  const activeCallRef = useRef<any | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  // Mapeamento entre PJSIP Call ID e CallKeep UUID
  const callKeepMappings = useRef<Record<string, string>>({});

  // --- Funções Auxiliares e de Controle (Definir PRIMEIRO) --- //
  const clearActiveCall = useCallback(
    (pjsipCallId?: string) => {
      const callIdToClear = pjsipCallId || activeCallRef.current?.getId();
      if (!callIdToClear) return;

      console.log(`Limpando chamada ativa PJSIP ID: ${callIdToClear}`);

      // Encerrar chamada no CallKeep se existir mapeamento
      const callKeepUUID = callKeepMappings.current[callIdToClear];
      if (callKeepUUID) {
        console.log(`Encerrando chamada CallKeep UUID: ${callKeepUUID}`);
        RNCallKeep.endCall(callKeepUUID);
        // Remover mapeamento
        const newMappings = { ...callKeepMappings.current };
        delete newMappings[callIdToClear];
        callKeepMappings.current = newMappings;
      } else {
        console.log(
          "Nenhum mapeamento CallKeep encontrado para PJSIP ID:",
          callIdToClear
        );
      }

      // Limpar referência PJSIP e estado local/global
      if (activeCallRef.current?.getId() === callIdToClear) {
        if (activeCallRef.current) {
          try {
            console.log("Removendo listeners da chamada ID:", callIdToClear);
            activeCallRef.current.removeAllListeners();
          } catch (e) {
            console.warn("Erro ao remover listeners:", e);
          }
        }
        activeCallRef.current = null;
        setActiveCall(null);
      }

      // Parar InCallManager e Ringtone
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

  // Definir attachCallListeners aqui
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
        // Assumir que getInfo() tem isIncoming
        const isIncomingCall =
          callInfo.isIncoming === true || callInfo.role === "UAS"; // Checar se é UAS (Server)
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
            // Usar a flag verificada
            RNCallKeep.reportConnectedOutgoingCallWithUUID(callKeepUUID);
          }
          InCallManager.start({ media: "audio" });
          // ... (resto da lógica InCallManager)
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
      const callId = pjsipCallIdToHangup || activeCallRef.current?.getId();
      console.log(`Tentando desligar/cancelar chamada PJSIP ID: ${callId}`);
      InCallManager.stopRingtone(); // Parar ringtone se estiver tocando

      const callToHangup =
        callId === activeCallRef.current?.getId()
          ? activeCallRef.current
          : null; // TODO: Precisaria buscar a instância da chamada PJSIP se não for a ativa (complexo)

      if (!callToHangup && callId) {
        // Se a chamada não é a ativa mas temos o ID (veio do CallKeep), apenas limpamos
        console.log("Chamada não ativa encontrada, limpando diretamente...");
        clearActiveCall(callId);
        return;
      }

      if (!callToHangup) {
        console.log("Nenhuma chamada ativa para desligar/cancelar.");
        return;
      }

      try {
        await callToHangup.hangup();
        console.log("Comando hangup enviado para chamada PJSIP ID:", callId);
        // A limpeza (incluindo CallKeep.endCall) será feita por on_call_state -> clearActiveCall
      } catch (error) {
        console.error("Erro ao desligar chamada PJSIP ID:", callId, error);
        Alert.alert(
          "Erro",
          `Falha ao desligar: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        clearActiveCall(callId); // Tenta limpar mesmo com erro
      }
    },
    [clearActiveCall]
  );

  const answerCall = useCallback(() => Promise.resolve(), []);
  const declineCall = useCallback(() => Promise.resolve(), []);

  // Definir toggleSpeaker AQUI, antes do return
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
      // ... (verificações iniciais, limpar chamada anterior se houver)
      try {
        const targetUri = `sip:${destination}@${sipConfig?.server}`;
        console.log(`Realizando chamada para ${targetUri}...`);

        // Gerar UUID para CallKeep ANTES de fazer a chamada PJSIP
        const callKeepUUID = uuid.v4() as string;
        const pjsipCallIdProvisorio = `outgoing-${callKeepUUID}`; // ID temporário antes de PJSIP criar um

        // Informar ao CallKeep sobre a chamada saindo
        console.log(`Iniciando chamada CallKeep UUID: ${callKeepUUID}`);
        RNCallKeep.startCall(
          callKeepUUID,
          destination, // Número discado
          destination, // Nome (pode melhorar)
          "number",
          false // hasVideo
        );

        // Tentar fazer a chamada PJSIP
        const call = await accountRef.current.makeCall(targetUri);
        const pjsipCallIdReal = call.getId();
        activeCallRef.current = call;
        console.log(`Chamada PJSIP iniciada, ID Real: ${pjsipCallIdReal}`);

        // Atualizar mapeamento com ID real
        callKeepMappings.current = {
          ...callKeepMappings.current,
          [pjsipCallIdReal]: callKeepUUID,
        };
        console.log(
          `Mapeamento criado: PJSIP ${pjsipCallIdReal} -> CallKeep ${callKeepUUID}`
        );
        // Remover mapeamento provisório se necessário (não usamos)

        // Anexar listeners PJSIP
        attachCallListeners(call);

        // Atualizar estado Zustand
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
        // Se falhar, precisamos encerrar a chamada no CallKeep também
        const callKeepUUID = Object.keys(callKeepMappings.current).find((key) =>
          key.startsWith("outgoing-")
        ); // Tentar achar pelo ID provisório?
        if (callKeepUUID) {
          RNCallKeep.endCall(callKeepUUID);
        }
        clearActiveCall();
      }
    },
    [sipConfig, setActiveCall, clearActiveCall, attachCallListeners]
  );

  // --- CallKeep Setup (Definir DEPOIS das funções de controle) --- //
  const setupCallKeep = useCallback(() => {
    console.log("Configurando RNCallKeep...");
    try {
      RNCallKeep.setup({
        ios: {
          appName: "SipNativeDemo", // Nome que aparece na UI do iOS
        },
        android: {
          alertTitle: "Permissions required",
          alertDescription:
            "This application needs to access your phone accounts",
          cancelButton: "Cancel",
          okButton: "Ok",
          additionalPermissions: [], // Adicionar permissões adicionais vazias
          // Required to get audio in background when using Android ConnectionService
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

    // --- Listeners do CallKeep --- //
    // Chamado quando o usuário atende pela UI nativa
    RNCallKeep.addEventListener("answerCall", ({ callUUID }) => {
      console.log(`[RNCallKeep] answerCall: ${callUUID}`);
      const pjsipCallId = Object.keys(callKeepMappings.current).find(
        (key) => callKeepMappings.current[key] === callUUID
      );
      if (pjsipCallId && activeCallRef.current?.getId() === pjsipCallId) {
        answerCall(); // Função já definida
      } else {
        console.warn(
          "[RNCallKeep] answerCall: Chamada PJSIP não encontrada para UUID:",
          callUUID
        );
      }
    });

    // Chamado quando o usuário desliga/rejeita pela UI nativa
    RNCallKeep.addEventListener("endCall", ({ callUUID }) => {
      console.log(`[RNCallKeep] endCall: ${callUUID}`);
      const pjsipCallId = Object.keys(callKeepMappings.current).find(
        (key) => callKeepMappings.current[key] === callUUID
      );
      if (pjsipCallId) {
        hangupCall(pjsipCallId); // Função já definida
      } else {
        console.warn(
          "[RNCallKeep] endCall: Chamada PJSIP não encontrada para UUID:",
          callUUID
        );
        // Garantir que a chamada seja encerrada no CallKeep de qualquer forma
        RNCallKeep.endCall(callUUID);
      }
    });

    // Outros listeners (DTMF, mute, hold) podem ser adicionados aqui

    return () => {
      console.log("Limpando listeners RNCallKeep...");
      RNCallKeep.removeEventListener("answerCall");
      RNCallKeep.removeEventListener("endCall");
      // RNCallKeep.destroy(); // Cuidado: pode impedir futuras chamadas
    };
  }, [answerCall, hangupCall]); // Dependências corretas

  // --- Efeito para configurar CallKeep ao montar (Definir DEPOIS do setupCallKeep)--- //
  useEffect(() => {
    const cleanupCallKeep = setupCallKeep();
    return cleanupCallKeep;
  }, [setupCallKeep]);

  // --- Efeito para Carregar Configuração SIP --- //
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
          // Validar os dados carregados antes de usar
          const validation = sipConfigSchema.safeParse(storedConfig);
          if (validation.success) {
            setSipConfig(validation.data);
          } else {
            console.warn(
              "Configuração SIP armazenada inválida:",
              validation.error.flatten()
            );
            await AsyncStorage.removeItem(ASYNC_STORAGE_SIP_CONFIG_KEY); // Remover config inválida
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

    // Carregar apenas se não houver configuração no estado ainda (evitar sobrescrever)
    if (!sipConfig) {
      loadConfig();
    }
    // Executar apenas uma vez ao montar o hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array de dependências vazio

  // --- Efeito de Inicialização PJSIP e Registro --- //
  useEffect(() => {
    const initializeAndRegister = async (config: SipConfig) => {
      // Prevenir inicialização dupla se já houver um endpoint
      if (endpointRef.current || accountRef.current) {
        console.log("PJSIP já inicializado, limpando antes de reconfigurar...");
        await clearActiveCall();
      }

      try {
        updateStatus("Configurando");
        console.log("Inicializando PJSIP...");

        const endpoint = new SipEndpoint();
        endpointRef.current = endpoint; // Armazenar referência
        await endpoint.start();
        console.log("PJSIP Endpoint iniciado.");

        // --- Listeners do Endpoint --- (Opcional)
        endpoint.addListener(
          "on_reg_state",
          (accId: any, accUri: any, code: any, reason: any) => {
            console.log(
              `Endpoint RegState: ${accId}, ${accUri}, Code: ${code}, Reason: ${reason}`
            );
          }
        );
        // Adicionar outros listeners de endpoint se necessário (ex: on_incoming_call)
        // -----------------------------

        const accountConfig = {
          uri: `sip:${config.username}@${config.server}`,
          registrar: `sip:${config.server}`,
          transport: "UDP",
          auth_user: config.username,
          auth_pass: config.password,
        };

        console.log("Configurando conta SIP:", accountConfig.uri);
        const account = await endpoint.createAccount(accountConfig);
        accountRef.current = account; // Armazenar referência
        console.log("Conta SIP criada, ID:", account.getId());

        // --- Listeners da Conta --- (Essenciais)
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
        // Adicionar outros listeners da conta se necessário (ex: on_incoming_call)
        // -------------------------

        account.addListener("on_incoming_call", async (call: any) => {
          const pjsipCallId = call.getId();
          const remoteUri = call.getInfo().remoteUri;
          console.log(`Chamada Recebida: ID=${pjsipCallId}, from=${remoteUri}`);

          if (activeCallRef.current) {
            console.warn("Rejeitando chamada recebida, já existe uma ativa.");
            try {
              await call.hangup({ statusCode: 486 }); // 486 Busy Here
            } catch (e) {
              console.error("Erro ao rejeitar chamada recebida (ocupado):", e);
            }
            return;
          }

          // Gerar UUID para CallKeep
          const callKeepUUID = uuid.v4() as string;
          callKeepMappings.current = {
            ...callKeepMappings.current,
            [pjsipCallId]: callKeepUUID,
          };
          console.log(
            `Mapeamento criado: PJSIP ${pjsipCallId} -> CallKeep ${callKeepUUID}`
          );

          // Definir como chamada ativa PJSIP
          activeCallRef.current = call;
          attachCallListeners(call);

          // Atualizar o store
          const incomingCallInfo: CallInfo = {
            id: pjsipCallId,
            remoteUri: remoteUri,
            state: "PJSIP_INV_STATE_INCOMING",
            stateText: getCallStateText("PJSIP_INV_STATE_INCOMING"),
          };
          setActiveCall(incomingCallInfo);

          // Mostrar UI nativa do CallKeep
          console.log("Exibindo chamada recebida no CallKeep...");
          RNCallKeep.displayIncomingCall(
            callKeepUUID,
            remoteUri, // Número/Nome a exibir
            remoteUri, // Nome do contato (pode melhorar buscando na lista)
            "number",
            true // hasVideo (ajustar se usar vídeo)
          );

          // Tocar Ringtone (opcional, CallKeep pode cuidar disso)
          // InCallManager.startRingtone('_DEFAULT_');
        });
        // -------------------------

        // ... (resto do código do useEffect)
      } catch (error) {
        console.error("Erro ao inicializar PJSIP:", error);
        // ... (resto do código do useEffect)
      }
    };

    if (sipConfig) {
      initializeAndRegister(sipConfig);
    } else {
      clearActiveCall();
    }

    // Função de limpeza do useEffect: chamada quando o componente desmonta
    // A limpeza ao mudar sipConfig já é feita no início de initializeAndRegister
    return () => {
      // Garante a limpeza ao desmontar o componente que usa o hook
      if (sipConfig) {
        // Só limpa se havia uma configuração ativa
        clearActiveCall();
      }
    };

    // Removido setConnectionStatus da dependência, pois usamos updateStatus (que tem setConnectionStatus como dep)
    // Isso evita loops se o status mudar rapidamente.
  }, [
    sipConfig,
    clearActiveCall,
    updateStatus,
    setActiveCall,
    attachCallListeners,
  ]);

  // Retornar funções e estados relevantes (status, etc.)
  // Por enquanto, o hook apenas gerencia a conexão em background.
  // Retornaremos makeCall e hangupCall para serem usados pela UI.
  return {
    makeCall,
    hangupCall,
    answerCall,
    declineCall,
    toggleSpeaker,
    isSpeakerOn,
  };
}
