import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

const ipv4Regex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const domainRegex =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\.?$/;

export const sipConfigSchema = z.object({
  server: z
    .string()
    .min(1, "Servidor é obrigatório")
    .refine((value) => ipv4Regex.test(value) || domainRegex.test(value), {
      message: "Servidor deve ser um IP válido ou um nome de domínio",
    }),
  username: z.string().min(1, "Usuário/Ramal é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type SipConfig = z.infer<typeof sipConfigSchema>;

// Adicionar tipo para o Status da Conexão
export type ConnectionStatus =
  | "Desconectado"
  | "Conectando"
  | "Registrado"
  | "Não Registrado"
  | "Erro"
  | "Configurando";

export interface CallInfo {
  id: string;
  remoteUri: string;
  state: string;
  stateText: string;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
}

const ASYNC_STORAGE_CONTACTS_KEY = "sipContacts";

interface SipState {
  sipConfig: SipConfig | null;
  setSipConfig: (config: SipConfig | null) => void;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  activeCall: CallInfo | null;
  setActiveCall: (callInfo: CallInfo | null) => void;
  contacts: Contact[];
  addContact: (contact: Omit<Contact, "id">) => void;
  removeContact: (id: string) => void;
}

export const useSipStore = create<SipState>()(
  persist(
    (set) => ({
      sipConfig: null,
      connectionStatus: "Desconectado",
      activeCall: null,
      contacts: [],

      setSipConfig: (config) => set({ sipConfig: config }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setActiveCall: (callInfo) => set({ activeCall: callInfo }),
      addContact: (contactData) =>
        set((state) => ({
          contacts: [
            ...state.contacts,
            { ...contactData, id: Date.now().toString() },
          ],
        })),
      removeContact: (id) =>
        set((state) => ({
          contacts: state.contacts.filter((contact) => contact.id !== id),
        })),
    }),
    {
      name: ASYNC_STORAGE_CONTACTS_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ contacts: state.contacts }),
    }
  )
);
