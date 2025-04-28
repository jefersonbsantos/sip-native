import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Alert } from "react-native";
// import { SipProvider } from "./context/SipContext";

// Importaremos o formulário aqui em breve
import SipConfigurationForm from "./components/SipConfigurationForm";
// Importaremos o footer aqui em breve
import SipStatusFooter from "./components/SipStatusFooter";
import { useSipStore, SipConfig } from "./store/sipStore"; // Importar store e tipo SipConfig
import PjSip, { SipEndpoint, SipAccount } from "react-native-pjsip"; // Importar PjSip

export default function App() {
  const { sipConfig, setConnectionStatus } = useSipStore((state) => ({
    sipConfig: state.sipConfig,
    setConnectionStatus: state.setConnectionStatus,
  }));

  // --- Efeito para gerenciar a conexão PJSIP ---
  useEffect(() => {
    let endpoint: SipEndpoint | null = null;
    let account: SipAccount | null = null;

    const initializeAndRegister = async (config: SipConfig) => {
      try {
        setConnectionStatus("Configurando");
        console.log("Inicializando PJSIP...");

        // 1. Criar e configurar o Endpoint
        endpoint = new SipEndpoint();
        await endpoint.start(); // Inicializa a stack SIP
        console.log("PJSIP Endpoint iniciado.");

        // Eventos do Endpoint (opcional, mas útil para debug)
        endpoint.addListener(
          "on_reg_state",
          (accId: any, accUri: any, code: any, reason: any) => {
            console.log(
              `Endpoint RegState: ${accId}, ${accUri}, Code: ${code}, Reason: ${reason}`
            );
            // Poderíamos ter lógica mais fina aqui se tivéssemos múltiplas contas
          }
        );

        // 2. Criar e configurar a Conta
        const accountConfig = {
          uri: `sip:${config.username}@${config.server}`,
          registrar: `sip:${config.server}`,
          transport: "UDP", // Ou TCP/TLS dependendo do servidor
          auth_user: config.username,
          auth_pass: config.password,
        };

        console.log("Configurando conta SIP:", accountConfig.uri);
        account = await endpoint.createAccount(accountConfig);
        console.log("Conta SIP criada, ID:", account.getId());

        // 3. Adicionar Listeners da Conta (CRUCIAL para status)
        account.addListener(
          "on_reg_state",
          (status: any, reason: any, code: any) => {
            console.log(
              `Account RegState: Status=${status}, Reason=${reason}, Code=${code}`
            );
            if (status === "registered") {
              setConnectionStatus("Registrado");
            } else if (status === "unregistered") {
              setConnectionStatus("Não Registrado");
              // Poderia tentar registrar novamente aqui ou mostrar erro
            } else if (status === "failed" || code >= 400) {
              setConnectionStatus("Erro");
              Alert.alert(
                "Erro de Registro SIP",
                `Falha ao registrar: ${reason} (Código: ${code})`
              );
            } else {
              setConnectionStatus("Conectando"); // Outros estados intermediários
            }
          }
        );

        // Iniciar o processo de registro
        console.log("Registrando conta...");
        setConnectionStatus("Conectando");
        await account.register(true); // true para registrar, false para desregistrar
      } catch (error) {
        console.error("Erro ao configurar PJSIP:", error);
        setConnectionStatus("Erro");
        Alert.alert(
          "Erro PJSIP",
          `Falha na inicialização: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        // Limpar recursos se a inicialização falhar parcialmente
        if (account) await account.release();
        if (endpoint) await endpoint.release();
        endpoint = null;
        account = null;
      }
    };

    const unregisterAndRelease = async () => {
      console.log("Desregistrando e liberando PJSIP...");
      setConnectionStatus("Desconectado");
      try {
        if (account) {
          await account.register(false); // Desregistrar
          await account.release();
          console.log("Conta SIP liberada.");
        }
        if (endpoint) {
          await endpoint.release();
          console.log("Endpoint PJSIP liberado.");
        }
      } catch (error) {
        console.error("Erro ao liberar PJSIP:", error);
      } finally {
        account = null;
        endpoint = null;
      }
    };

    if (sipConfig) {
      // Se temos configuração, tenta inicializar e registrar
      initializeAndRegister(sipConfig);
    } else {
      // Se a configuração for removida (ou null inicialmente), desregistra e libera
      unregisterAndRelease();
    }

    // Função de limpeza do useEffect: chamada quando o componente desmonta ou sipConfig muda
    return () => {
      unregisterAndRelease();
    };
  }, [sipConfig, setConnectionStatus]); // Dependências do efeito
  // --- Fim do Efeito PJSIP ---

  return (
    // <SipProvider>
    <View style={styles.container}>
      <Text style={styles.title}>Configuração SIP</Text>
      {/* Renderizaremos o formulário aqui */}
      <SipConfigurationForm />
      {/* O status virá aqui embaixo depois */}
      <SipStatusFooter />
      <StatusBar style="auto" />
    </View>
    // </SipProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
