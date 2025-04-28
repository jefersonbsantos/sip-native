import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useSipStore, Contact } from "../store/sipStore";
import { usePjSipManager } from "../hooks/usePjSipManager";

export default function ContactList() {
  const contacts = useSipStore((state) => state.contacts);
  const removeContact = useSipStore((state) => state.removeContact);
  const { makeCall } = usePjSipManager();
  const activeCall = useSipStore((state) => state.activeCall);

  const handleCallContact = (contact: Contact) => {
    makeCall(contact.number);
  };

  const handleRemoveContact = (id: string) => {
    // Adicionar confirmação se desejar
    removeContact(id);
  };

  const renderItem = ({ item }: { item: Contact }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactNumber}>{item.number}</Text>
      </View>
      <View style={styles.contactActions}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.callButton,
            activeCall ? styles.disabledButton : {},
          ]}
          onPress={() => handleCallContact(item)}
          disabled={activeCall !== null}
        >
          <Text style={styles.buttonText}>Ligar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.removeButton,
            activeCall ? styles.disabledButton : {},
          ]} // Desabilitar durante chamada
          onPress={() => handleRemoveContact(item.id)}
          disabled={activeCall !== null}
        >
          <Text style={styles.buttonText}>Remover</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {contacts.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum contato adicionado ainda.</Text>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}
      {/* Formulário para adicionar contatos virá aqui depois */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "90%",
    marginTop: 10,
    // Adicionar altura ou flex se necessário dentro de um layout complexo
    // maxHeight: 200, // Exemplo de altura máxima se precisar limitar
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 5,
  },
  list: {
    padding: 10,
  },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  contactInfo: {
    flex: 1, // Ocupa espaço disponível
    marginRight: 10,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  contactNumber: {
    fontSize: 14,
    color: "#555",
  },
  contactActions: {
    flexDirection: "row",
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  callButton: {
    backgroundColor: "#007bff", // Azul
  },
  removeButton: {
    backgroundColor: "#dc3545", // Vermelho
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  emptyText: {
    textAlign: "center",
    padding: 20,
    fontSize: 16,
    color: "gray",
  },
});
