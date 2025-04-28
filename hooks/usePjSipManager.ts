import { useEffect, useRef, useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import PjSip, { SipEndpoint, SipAccount, SipCall } from "react-native-pjsip";
import InCallManager from "react-native-incall-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  hangupCall: () => Promise<void>;
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

  const updateStatus = useCallback(
    (status: ConnectionStatus) => {
      setConnectionStatus(status);
    },
    [setConnectionStatus]
  );

  // Função para limpar chamada ativa (remove listeners, atualiza store)
  const clearActiveCall = useCallback(() => {
    if (activeCallRef.current) {
      try {
        console.log(
          "Removendo listeners da chamada ID:",
          activeCallRef.current.getId()
        );
        activeCallRef.current.removeAllListeners();
      } catch (e) {
        console.warn("Erro ao remover listeners da chamada:", e);
      }
      activeCallRef.current = null;
    }
    // Parar InCallManager e Ringtone ao limpar a chamada
    console.log("Parando InCallManager e Ringtone (clearActiveCall)");
    InCallManager.stopRingtone();
    InCallManager.stop();
    setIsSpeakerOn(false);
    setActiveCall(null);
  }, [setActiveCall]);

  // --- Função para anexar listeners a uma chamada --- (Reutilizável)
  const attachCallListeners = useCallback(
    (call: any) => {
      console.log("Anexando listeners para chamada ID:", call.getId());
      // Remover listeners antigos por segurança (não deve acontecer normalmente)
      call.removeAllListeners();

      call.addListener("on_call_state", (newState: string, reason: any) => {
        console.log(
          `Call State Changed: ID=${call.getId()}, State=${newState}, Reason=${reason}`
        );
        const callInfo = call.getInfo();
        const stateText = getCallStateText(newState);
        const updatedCallInfo: CallInfo = {
          id: call.getId(),
          remoteUri: callInfo.remoteUri,
          state: newState,
          stateText: stateText,
        };
        setActiveCall(updatedCallInfo);

        if (newState === "PJSIP_INV_STATE_CONFIRMED") {
          console.log("Chamada confirmada, iniciando InCallManager...");
          InCallManager.start({ media: "audio" });
          InCallManager.setForceSpeakerphoneOn(false);
          InCallManager.setSpeakerphoneOn(false);
          setIsSpeakerOn(false);
          if (Platform.OS === "ios") {
            InCallManager.setMicrophoneMute(false);
          }
        } else if (newState === "PJSIP_INV_STATE_DISCONNECTED") {
          console.log(
            `Chamada ${call.getId()} desconectada (evento on_call_state).`
          );
          if (activeCallRef.current?.getId() === call.getId()) {
            clearActiveCall();
          }
        }
      });

      call.addListener("on_call_media_state", (mediaInfo: any) => {
        console.log(`Call Media State Changed: ID=${call.getId()}`, mediaInfo);
      });
    },
    [setActiveCall, clearActiveCall]
  );

  // Função para limpar recursos PJSIP (incluindo chamada ativa)
  const cleanupPjsip = useCallback(async () => {
    console.log("Limpando recursos PJSIP...");
    clearActiveCall(); // Limpar chamada ativa primeiro
    updateStatus("Desconectado");
    try {
      if (accountRef.current) {
        // Remover listeners da conta antes de liberar
        accountRef.current.removeAllListeners();
        // Tentar desregistrar (pode falhar se já desconectado, tratar silenciosamente)
        try {
          await accountRef.current.register(false);
        } catch (regError) {
          console.log("Falha silenciosa ao desregistrar:", regError);
        }
        await accountRef.current.release();
        console.log("Conta SIP liberada.");
      }
      if (endpointRef.current) {
        // Remover listeners do endpoint antes de liberar
        endpointRef.current.removeAllListeners();
        await endpointRef.current.release();
        console.log("Endpoint PJSIP liberado.");
      }
    } catch (error) {
      console.error("Erro ao liberar PJSIP:", error);
    } finally {
      accountRef.current = null;
      endpointRef.current = null;
    }
  }, [updateStatus, clearActiveCall]);

  // Definir hangupCall ANTES de makeCall
  const hangupCall = useCallback(async () => {
    console.log("Tentando desligar/cancelar a chamada...");
    // Parar ringtone caso esteja tocando (ex: usuário cancela incoming call)
    InCallManager.stopRingtone();
    const call = activeCallRef.current;
    if (!call) {
      return;
    }
    try {
      await call.hangup();
      console.log("Comando hangup enviado para chamada ID:", call.getId());
    } catch (error) {
      console.error("Erro ao desligar chamada:", error);
      Alert.alert(
        "Erro",
        `Falha ao desligar: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      clearActiveCall(); // Tenta limpar mesmo com erro
    }
  }, [clearActiveCall]);

  // Definir makeCall DEPOIS de hangupCall
  const makeCall = useCallback(
    async (destination: string) => {
      console.log(`Tentando ligar para: ${destination}`);
      const account = accountRef.current;
      if (!account) {
        Alert.alert("Erro", "Conta SIP não está registrada.");
        return;
      }
      if (!destination) {
        Alert.alert("Erro", "Número de destino não pode ser vazio.");
        return;
      }
      if (activeCallRef.current) {
        console.warn(
          "Já existe uma chamada ativa, limpando antes de iniciar nova."
        );
        await hangupCall(); // Agora hangupCall está definida
      }

      try {
        const targetUri = `sip:${destination}@${sipConfig?.server}`;
        console.log(`Realizando chamada para ${targetUri}...`);
        const call = await account.makeCall(targetUri);
        activeCallRef.current = call;
        attachCallListeners(call); // Usar função reutilizável
        console.log("Chamada iniciada, ID:", call.getId());

        const initialCallInfo: CallInfo = {
          id: call.getId(),
          remoteUri: call.getInfo().remoteUri,
          state: "PJSIP_INV_STATE_CALLING",
          stateText: getCallStateText("PJSIP_INV_STATE_CALLING"),
        };
        setActiveCall(initialCallInfo);

        // Tocar Ringtone
        console.log("Iniciando Ringtone...");
        InCallManager.startRingtone("_DEFAULT_");
      } catch (error) {
        console.error("Erro ao realizar chamada:", error);
        Alert.alert(
          "Erro na Chamada",
          `Falha ao iniciar: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        clearActiveCall();
      }
    },
    [sipConfig, setActiveCall, clearActiveCall, hangupCall, attachCallListeners]
  );

  // --- Efeito para Carregar Configuração ao Montar --- //
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

  // --- Efeito de Inicialização e Registro (depende de sipConfig) --- //
  useEffect(() => {
    const initializeAndRegister = async (config: SipConfig) => {
      // Prevenir inicialização dupla se já houver um endpoint
      if (endpointRef.current || accountRef.current) {
        console.log("PJSIP já inicializado, limpando antes de reconfigurar...");
        await cleanupPjsip();
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
          console.log(
            `Chamada Recebida: ID=${call.getId()}, from=${
              call.getInfo().remoteUri
            }`
          );

          if (activeCallRef.current) {
            console.warn("Rejeitando chamada recebida, já existe uma ativa.");
            try {
              await call.hangup({ statusCode: 486 }); // 486 Busy Here
            } catch (e) {
              console.error("Erro ao rejeitar chamada recebida (ocupado):", e);
            }
            return;
          }

          // Definir como chamada ativa
          activeCallRef.current = call;
          attachCallListeners(call); // Anexar listeners on_call_state etc.

          // Atualizar o store
          const callInfo = call.getInfo();
          const incomingCallInfo: CallInfo = {
            id: call.getId(),
            remoteUri: callInfo.remoteUri,
            state: "PJSIP_INV_STATE_INCOMING",
            stateText: getCallStateText("PJSIP_INV_STATE_INCOMING"),
          };
          setActiveCall(incomingCallInfo);

          // Tocar Ringtone DEPOIS de atualizar o estado
          console.log("Iniciando Ringtone...");
          InCallManager.startRingtone("_DEFAULT_");
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
      cleanupPjsip();
    }

    // Função de limpeza do useEffect: chamada quando o componente desmonta
    // A limpeza ao mudar sipConfig já é feita no início de initializeAndRegister
    return () => {
      // Garante a limpeza ao desmontar o componente que usa o hook
      if (sipConfig) {
        // Só limpa se havia uma configuração ativa
        cleanupPjsip();
      }
    };

    // Removido setConnectionStatus da dependência, pois usamos updateStatus (que tem setConnectionStatus como dep)
    // Isso evita loops se o status mudar rapidamente.
  }, [
    sipConfig,
    cleanupPjsip,
    updateStatus,
    setActiveCall,
    attachCallListeners,
  ]);

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

  // Retornar funções e estados relevantes (status, etc.)
  // Por enquanto, o hook apenas gerencia a conexão em background.
  // Retornaremos makeCall e hangupCall para serem usados pela UI.
  return {
    makeCall,
    hangupCall,
    answerCall: () => Promise.resolve(),
    declineCall: () => Promise.resolve(),
    toggleSpeaker,
    isSpeakerOn,
  };
}
