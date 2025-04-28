import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useSipStore } from "../store/sipStore";
import { z } from "zod";

// Schema Zod simples para validação do formulário
const contactFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  number: z.string().min(1, "Número/Ramal é obrigatório"), // Poderia validar formato numérico/SIP aqui
});

export default function AddContactForm() {
  const addContact = useSipStore((state) => state.addContact);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddContact = () => {
    const formData = { name, number };
    try {
      // Validar com Zod
      const validatedData = contactFormSchema.parse(formData);
      setErrors({}); // Limpar erros

      // Chamar ação do store
      addContact(validatedData);

      // Limpar formulário e dar feedback
      setName("");
      setNumber("");
      Alert.alert("Sucesso", "Contato adicionado!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Formatar e mostrar erros de validação Zod
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
        console.error("Erro inesperado ao adicionar contato:", error);
        Alert.alert("Erro", "Ocorreu um erro inesperado.");
        setErrors({});
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome:</Text>
      <TextInput
        style={[styles.input, errors.name ? styles.inputError : null]}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors((prev) => ({ ...prev, name: "" }));
        }}
        placeholder="Nome do Contato"
      />
      {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

      <Text style={styles.label}>Número/Ramal:</Text>
      <TextInput
        style={[styles.input, errors.number ? styles.inputError : null]}
        value={number}
        onChangeText={(text) => {
          setNumber(text);
          setErrors((prev) => ({ ...prev, number: "" }));
        }}
        placeholder="Ex: 1005 ou *43"
        keyboardType="phone-pad" // Teclado numérico sugerido
      />
      {errors.number && <Text style={styles.errorText}>{errors.number}</Text>}

      <Button title="Adicionar Contato" onPress={handleAddContact} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "90%",
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
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
