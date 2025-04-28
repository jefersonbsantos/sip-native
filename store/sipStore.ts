import { create } from "zustand";
import { z } from "zod";

// 1. Schema de Validação Zod para a Configuração SIP
export const sipConfigSchema = z.object({
  server: z.string().min(1, "Servidor é obrigatório"), // Exemplo: não pode ser vazio
  username: z.string().min(1, "Usuário/Ramal é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
  // Poderíamos adicionar validações mais específicas (ex: formato do servidor)
});

// 2. Inferir o tipo TypeScript a partir do schema Zod
export type SipConfig = z.infer<typeof sipConfigSchema>;

// Adicionar tipo para o Status da Conexão
export type ConnectionStatus =
  | "Desconectado"
  | "Conectando"
  | "Registrado"
  | "Não Registrado"
  | "Erro"
  | "Configurando";

// Interface para informações da chamada (pode ser importada do hook ou duplicada)
// Por simplicidade, vamos duplicar/redefinir aqui, mas importar seria melhor
export interface CallInfo {
  id: string;
  remoteUri: string;
  state: string;
  stateText: string; // Texto descritivo do estado (ex: "Calling", "Confirmed")
  // Adicionar mais infos úteis: direction ('incoming'/'outgoing'), duration, mediaState
}

// Interface para Contato/Ramal
export interface Contact {
  id: string; // Identificador único (pode ser gerado)
  name: string;
  number: string; // O número/ramal SIP
}

// 3. Definir a interface do Estado do Store
interface SipState {
  sipConfig: SipConfig | null;
  setSipConfig: (config: SipConfig | null) => void;
  connectionStatus: ConnectionStatus; // Adicionar estado de conexão
  setConnectionStatus: (status: ConnectionStatus) => void; // Adicionar ação para status
  activeCall: CallInfo | null; // Adicionar estado da chamada ativa
  setActiveCall: (callInfo: CallInfo | null) => void; // Adicionar ação para chamada
  contacts: Contact[]; // Adicionar lista de contatos
  addContact: (contact: Omit<Contact, "id">) => void; // Adicionar ação para adicionar
  removeContact: (id: string) => void; // Adicionar ação para remover
  // Poderíamos adicionar updateContact depois
}

// 4. Criar o Store Zustand
export const useSipStore = create<SipState>((set) => ({
  // Estado Inicial
  sipConfig: null,
  connectionStatus: "Desconectado", // Estado inicial do status
  activeCall: null, // Inicializar chamada ativa como null
  contacts: [
    // Inicializar com alguns contatos de exemplo
    { id: "1", name: "Ramal Teste 1", number: "1001" },
    { id: "2", name: "Ramal Teste 2", number: "1002" },
    { id: "3", name: "Echo Test (Público)", number: "*43" }, // Exemplo comum
  ],

  // Ações
  setSipConfig: (config) => set({ sipConfig: config }),
  setConnectionStatus: (status) => set({ connectionStatus: status }), // Implementar ação
  setActiveCall: (callInfo) => set({ activeCall: callInfo }), // Implementar ação
  addContact: (contactData) =>
    set((state) => ({
      contacts: [
        ...state.contacts,
        { ...contactData, id: Date.now().toString() }, // Adiciona com ID simples
      ],
    })),
  removeContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((contact) => contact.id !== id),
    })),
}));
