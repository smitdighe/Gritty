import { create } from 'zustand';

/**
 * Local UI state (not server state — that lives in react-query). Tracks which
 * repo is active and which commit/branch the user has selected across views.
 * No persistence yet (phase 6+ may add it).
 */
export interface RepoState {
  /** Working-tree path the backend should operate on (mock/default for now). */
  activeRepoPath: string | null;
  /** SHA of the commit the user is inspecting, or null. */
  selectedCommitSha: string | null;
  /** Branch name the user has selected in the UI, or null. */
  selectedBranch: string | null;

  setActiveRepoPath: (path: string | null) => void;
  setSelectedCommitSha: (sha: string | null) => void;
  setSelectedBranch: (name: string | null) => void;
}

export const useRepoStore = create<RepoState>((set) => ({
  activeRepoPath: null,
  selectedCommitSha: null,
  selectedBranch: null,

  setActiveRepoPath: (activeRepoPath) => set({ activeRepoPath }),
  setSelectedCommitSha: (selectedCommitSha) => set({ selectedCommitSha }),
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),
}));
