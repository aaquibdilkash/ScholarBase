type FollowState = Record<string, boolean>;

type Listener = (state: FollowState) => void;

const listeners = new Set<Listener>();
let state: FollowState = {};

export function getFollowState() {
  return state;
}

export function subscribeFollowState(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setFollowStateForUser(userId: string, isFollowing: boolean) {
  state = { ...state, [userId]: isFollowing };
  listeners.forEach((l) => l(state));
}

export function resetFollowState() {
  state = {};
}
