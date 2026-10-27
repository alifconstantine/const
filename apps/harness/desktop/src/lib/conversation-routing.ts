/** Resolve history by chat identity, including when a queue resumes in the background. */
export function resolveConversationHistory<T>(
  targetId: string,
  visibleId: string,
  visibleMessages: T[],
  liveMessages: Map<string, T[]>,
  storedMessages: T[] = [],
) {
  const isVisible = targetId === visibleId;
  return {
    isVisible,
    history: liveMessages.get(targetId) || (isVisible ? visibleMessages : storedMessages),
  };
}
