import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
// import { useSip } from '../context/SipContext'; // Remover import do contexto antigo
import { useSipStore, sipConfigSchema } from "../store/sipStore"; // Importar store Zustand e schema Zod
import { ZodError } from "zod";

export default function SipConfigurationForm() {
  // const { setSipConfig } = useSip(); // Remover uso do contexto antigo
  const setSipConfig = useSipStore((state) => state.setSipConfig); // Obter ação do store Zustand

  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}); // Estado para erros de validação

  const handleSaveConfig = () => {
    const configToValidate = { server, username, password };
    try {
      // Validar usando o schema Zod
      const validatedConfig = sipConfigSchema.parse(configToValidate);

      // Limpar erros antigos
      setErrors({});

      // Salva a configuração no store Zustand
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
      setSipConfig(null); // Garantir que não há config inválida no store
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
      {errors.server && <Text style={styles.errorText}>{errors.server}</Text>}{" "}
      // Exibir erro
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
