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

// 3. Definir a interface do Estado do Store
interface SipState {
  sipConfig: SipConfig | null;
  setSipConfig: (config: SipConfig | null) => void;
  connectionStatus: ConnectionStatus; // Adicionar estado de conexão
  setConnectionStatus: (status: ConnectionStatus) => void; // Adicionar ação para status
}

// 4. Criar o Store Zustand
export const useSipStore = create<SipState>((set) => ({
  // Estado Inicial
  sipConfig: null,
  connectionStatus: "Desconectado", // Estado inicial do status

  // Ações
  setSipConfig: (config) => set({ sipConfig: config }),
  setConnectionStatus: (status) => set({ connectionStatus: status }), // Implementar ação
}));
