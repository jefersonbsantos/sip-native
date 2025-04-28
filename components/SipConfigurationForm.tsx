import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useSipStore, sipConfigSchema, SipConfig } from "../store/sipStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ZodError } from "zod";

const ASYNC_STORAGE_SIP_CONFIG_KEY = "sipConfig";

export default function SipConfigurationForm() {
  const { sipConfig, setSipConfig } = useSipStore((state) => ({
    sipConfig: state.sipConfig,
    setSipConfig: state.setSipConfig,
  }));

  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sipConfig) {
      setServer(sipConfig.server);
      setUsername(sipConfig.username);
      setPassword(sipConfig.password);
      setErrors({});
    }
  }, [sipConfig]);

  const handleSaveConfig = async () => {
    const configToValidate = { server, username, password };
    try {
      const validatedConfig = sipConfigSchema.parse(configToValidate);
      setErrors({});
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
        return;
      }

      setSipConfig(validatedConfig);
      Alert.alert("Sucesso", "Configuração SIP salva!");
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            formattedErrors[err.path[0]] = err.message;
          }
        });
        setErrors(formattedErrors);
        Alert.alert(
          "Erro de Validação",
          "Por favor, corrija os campos indicados."
        );
      } else {
        console.error("Erro inesperado ao salvar config:", error);
        Alert.alert("Erro", "Ocorreu um erro inesperado.");
        setErrors({});
      }
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
    marginBottom: 5,
    borderRadius: 4,
    fontSize: 16,
  },
  inputError: {
    borderColor: "red",
  },
  errorText: {
    color: "red",
    fontSize: 12,
    marginBottom: 10,
  },
});
