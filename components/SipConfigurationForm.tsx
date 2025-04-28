import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
// import { useSip } from '../context/SipContext'; // Remover import do contexto antigo
import { useSipStore, sipConfigSchema, SipConfig } from "../store/sipStore"; // Importar store Zustand e schema Zod
import AsyncStorage from "@react-native-async-storage/async-storage"; // Importar AsyncStorage
import { ZodError } from "zod";

const ASYNC_STORAGE_SIP_CONFIG_KEY = "sipConfig"; // Mesma chave usada no hook

export default function SipConfigurationForm() {
  // const { setSipConfig } = useSip(); // Remover uso do contexto antigo
  const { sipConfig, setSipConfig } = useSipStore((state) => ({
    sipConfig: state.sipConfig,
    setSipConfig: state.setSipConfig,
  }));

  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}); // Estado para erros de validação

  // Efeito para preencher o formulário quando a config for carregada/modificada
  useEffect(() => {
    if (sipConfig) {
      setServer(sipConfig.server);
      setUsername(sipConfig.username);
      setPassword(sipConfig.password);
      setErrors({}); // Limpar erros antigos ao carregar
    }
    // Se sipConfig se tornar null (ex: logout futuro), poderíamos limpar o form aqui
  }, [sipConfig]);

  const handleSaveConfig = async () => {
    const configToValidate = { server, username, password };
    try {
      const validatedConfig = sipConfigSchema.parse(configToValidate);
      setErrors({});

      // Salvar no AsyncStorage ANTES de atualizar o estado global
      try {
        await AsyncStorage.setItem(
          ASYNC_STORAGE_SIP_CONFIG_KEY,
          JSON.stringify(validatedConfig)
        );
        console.log("Configuração SIP salva no AsyncStorage.");
      } catch (error) {
        console.error(
          "Erro ao salvar configuração SIP no AsyncStorage:",
          error
        );
        Alert.alert(
          "Erro",
          "Não foi possível salvar a configuração permanentemente."
        );
        // Considerar não atualizar o estado global se o salvamento falhar?
        // Ou apenas alertar o usuário?
        return; // Impedir atualização do estado global se salvar falhou
      }

      // Atualizar estado global (Zustand)
      setSipConfig(validatedConfig);
      Alert.alert("Sucesso", "Configuração SIP salva!");
      // Poderíamos limpar os campos aqui se desejado
      // setServer(''); setUsername(''); setPassword('');
    } catch (error) {
      if (error instanceof ZodError) {
        // Formatar erros do Zod para exibição
        const formattedErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            formattedErrors[err.path[0]] = err.message;
          }
        });
        setErrors(formattedErrors);
        // Exibir um alerta geral ou mensagens nos campos
        Alert.alert(
          "Erro de Validação",
          "Por favor, corrija os campos indicados."
        );
      } else {
        // Tratar outros erros inesperados
        console.error("Erro inesperado ao salvar config:", error);
        Alert.alert("Erro", "Ocorreu um erro inesperado.");
        setErrors({}); // Limpar erros
      }
      // Não limpar config no store aqui, pois pode ser um erro de validação temporário
      // setSipConfig(null); // Remover esta linha do catch
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Servidor SIP:</Text>
      <TextInput
        style={[styles.input, errors.server ? styles.inputError : null]} // Estilo de erro
        value={server}
        onChangeText={(text) => {
          setServer(text);
          setErrors((prev) => ({ ...prev, server: "" }));
        }}
        placeholder="ex: sip.example.com"
        autoCapitalize="none"
      />
      {errors.server && <Text style={styles.errorText}>{errors.server}</Text>}
      <Text style={styles.label}>Usuário/Ramal:</Text>
      <TextInput
        style={[styles.input, errors.username ? styles.inputError : null]}
        value={username}
        onChangeText={(text) => {
          setUsername(text);
          setErrors((prev) => ({ ...prev, username: "" }));
        }}
        placeholder="ex: 1001"
        autoCapitalize="none"
      />
      {errors.username && (
        <Text style={styles.errorText}>{errors.username}</Text>
      )}
      <Text style={styles.label}>Senha:</Text>
      <TextInput
        style={[styles.input, errors.password ? styles.inputError : null]}
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setErrors((prev) => ({ ...prev, password: "" }));
        }}
        placeholder="Sua senha"
        secureTextEntry
        autoCapitalize="none"
      />
      {errors.password && (
        <Text style={styles.errorText}>{errors.password}</Text>
      )}
      <Button title="Salvar Configuração" onPress={handleSaveConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "80%",
    padding: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    marginBottom: 5, // Reduzir margem para erro caber embaixo
    borderRadius: 4,
    fontSize: 16,
  },
  inputError: {
    // Novo estilo para input com erro
    borderColor: "red",
  },
  errorText: {
    // Novo estilo para texto de erro
    color: "red",
    fontSize: 12,
    marginBottom: 10, // Espaço após a mensagem de erro
  },
});
