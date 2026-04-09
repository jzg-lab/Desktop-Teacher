/**
 * 会话运行时上下文
 *
 * 管理当前活跃会话的状态：正在进行的会话 ID、已加载的 Turn 列表、加载状态、
 * 技能调用状态和来源引用。
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
} from "../services/storage";
import type {
  ConversationMeta,
  Turn,
  Role,
  RouteType,
  SourceRef,
} from "../services/storage";
import type { SkillCallInfo } from "../services/skills/types";

export type ViewMode = "empty" | "chat" | "history";

interface ConversationState {
  activeConversation: ConversationMeta | null;
  turns: Turn[];
  viewMode: ViewMode;
  loading: boolean;
  streamingText: string;
  threadImageData: string | null;
  skillCallInfo: SkillCallInfo | null;
  sources: SourceRef[];
}

interface ConversationActions {
  startNewConversation: (title?: string) => Promise<ConversationMeta>;
  openConversation: (meta: ConversationMeta) => Promise<void>;
  appendTurn: (
    role: Role,
    content: string,
    routeType?: RouteType | null,
    conversationId?: string,
    extra?: Record<string, unknown>,
  ) => Promise<Turn>;
  closeConversation: () => void;
  removeConversation: (id: string) => Promise<void>;
  showHistory: () => void;
  dismissHistory: () => void;
  setStreamingText: (text: string) => void;
  setThreadImageData: (data: string | null) => void;
  setSkillCallInfo: (info: SkillCallInfo | null) => void;
  setSources: (sources: SourceRef[]) => void;
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
    streamingText: "",
    threadImageData: null,
    skillCallInfo: null,
    sources: [],
  });

  useEffect(() => {
    function handleBeforeUnload() {
      setState({
        activeConversation: null,
        turns: [],
        viewMode: "empty",
        loading: false,
        streamingText: "",
        threadImageData: null,
        skillCallInfo: null,
        sources: [],
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
          streamingText: "",
          threadImageData: null,
          skillCallInfo: null,
          sources: [],
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
          streamingText: "",
          threadImageData: null,
          skillCallInfo: null,
          sources: [],
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
      extra?: Record<string, unknown>,
    ): Promise<Turn> => {
      const convId = conversationId ?? state.activeConversation?.id;
      if (!convId) {
        throw new Error("No active conversation");
      }

      const turn = await storageAppendTurn(convId, {
        role,
        content,
        route_type: routeType ?? null,
        tool_calls: extra?.tool_calls,
        tool_call_id: extra?.tool_call_id as string | undefined,
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

  const closeConversation = useCallback(() => {
    setState({
      activeConversation: null,
      turns: [],
      viewMode: "empty",
      loading: false,
      streamingText: "",
      threadImageData: null,
      skillCallInfo: null,
      sources: [],
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
          streamingText: "",
          threadImageData: null,
          skillCallInfo: null,
          sources: [],
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

  const setStreamingText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, streamingText: text }));
  }, []);

  const setThreadImageData = useCallback((data: string | null) => {
    setState((prev) => ({ ...prev, threadImageData: data }));
  }, []);

  const setSkillCallInfo = useCallback((info: SkillCallInfo | null) => {
    setState((prev) => ({ ...prev, skillCallInfo: info }));
  }, []);

  const setSources = useCallback((sources: SourceRef[]) => {
    setState((prev) => ({ ...prev, sources }));
  }, []);

  const value: ConversationContextValue = {
    ...state,
    startNewConversation,
    openConversation,
    appendTurn,
    closeConversation,
    removeConversation,
    showHistory,
    dismissHistory,
    setStreamingText,
    setThreadImageData,
    setSkillCallInfo,
    setSources,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}