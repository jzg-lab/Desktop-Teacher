/**
 * 会话运行时上下文
 *
 * 管理当前活跃会话的状态：正在进行的会话 ID、已加载的 Turn 列表、加载状态。
 * 关闭窗口时自动清空，不持久化到本地存储。
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  createConversation,
  loadTurns,
  appendTurn as storageAppendTurn,
  deleteConversation as storageDeleteConversation,
  updateConversationTitle,
} from "../services/storage";
import type {
  ConversationMeta,
  Turn,
  Role,
  RouteType,
} from "../services/storage";

export type ViewMode = "empty" | "chat" | "history";

interface ConversationState {
  activeConversation: ConversationMeta | null;
  turns: Turn[];
  viewMode: ViewMode;
  loading: boolean;
}

interface ConversationActions {
  startNewConversation: (title?: string) => Promise<ConversationMeta>;
  openConversation: (meta: ConversationMeta) => Promise<void>;
  appendTurn: (
    role: Role,
    content: string,
    routeType?: RouteType | null,
    conversationId?: string,
  ) => Promise<Turn>;
  setTitle: (title: string) => Promise<void>;
  closeConversation: () => void;
  removeConversation: (id: string) => Promise<void>;
  showHistory: () => void;
  dismissHistory: () => void;
}

type ConversationContextValue = ConversationState & ConversationActions;

const ConversationContext = createContext<ConversationContextValue | null>(
  null,
);

export function useConversationContext(): ConversationContextValue {
  const ctx = useContext(ConversationContext);
  if (!ctx) {
    throw new Error(
      "useConversationContext must be used within ConversationProvider",
    );
  }
  return ctx;
}

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const [state, setState] = useState<ConversationState>({
    activeConversation: null,
    turns: [],
    viewMode: "empty",
    loading: false,
  });

  useEffect(() => {
    function handleBeforeUnload() {
      setState({
        activeConversation: null,
        turns: [],
        viewMode: "empty",
        loading: false,
      });
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const startNewConversation = useCallback(
    async (title?: string): Promise<ConversationMeta> => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const meta = await createConversation(title ?? "新会话");
        setState({
          activeConversation: meta,
          turns: [],
          viewMode: "chat",
          loading: false,
        });
        return meta;
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false }));
        throw err;
      }
    },
    [],
  );

  const openConversation = useCallback(
    async (meta: ConversationMeta): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const turns = await loadTurns(meta.id);
        setState({
          activeConversation: meta,
          turns,
          viewMode: "chat",
          loading: false,
        });
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false }));
        throw err;
      }
    },
    [],
  );

  const appendTurn = useCallback(
    async (
      role: Role,
      content: string,
      routeType?: RouteType | null,
      conversationId?: string,
    ): Promise<Turn> => {
      const convId = conversationId ?? state.activeConversation?.id;
      if (!convId) {
        throw new Error("No active conversation");
      }
      const turn = await storageAppendTurn(convId, {
        role,
        content,
        route_type: routeType ?? null,
      });
      setState((prev) => ({
        ...prev,
        turns: [...prev.turns, turn],
        activeConversation: prev.activeConversation
          ? { ...prev.activeConversation, updated_at: turn.created_at }
          : null,
      }));
      return turn;
    },
    [state.activeConversation],
  );

  const setTitle = useCallback(
    async (title: string): Promise<void> => {
      if (!state.activeConversation) return;
      await updateConversationTitle(state.activeConversation.id, title);
      setState((prev) => ({
        ...prev,
        activeConversation: prev.activeConversation
          ? { ...prev.activeConversation, title, updated_at: new Date().toISOString() }
          : null,
      }));
    },
    [state.activeConversation],
  );

  const closeConversation = useCallback(() => {
    setState({
      activeConversation: null,
      turns: [],
      viewMode: "empty",
      loading: false,
    });
  }, []);

  const removeConversation = useCallback(
    async (id: string): Promise<void> => {
      await storageDeleteConversation(id);
      if (state.activeConversation?.id === id) {
        setState({
          activeConversation: null,
          turns: [],
          viewMode: "empty",
          loading: false,
        });
      }
    },
    [state.activeConversation],
  );

  const showHistory = useCallback(() => {
    setState((prev) => ({ ...prev, viewMode: "history" as ViewMode }));
  }, []);

  const dismissHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      viewMode: prev.activeConversation ? ("chat" as ViewMode) : ("empty" as ViewMode),
    }));
  }, []);

  const value: ConversationContextValue = {
    ...state,
    startNewConversation,
    openConversation,
    appendTurn,
    setTitle,
    closeConversation,
    removeConversation,
    showHistory,
    dismissHistory,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
