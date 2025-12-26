// SonechkaApp.ts - Main application class

import { AppStateManager } from './AppStateManager';
import { FileStorage } from './FileStorage';
import { AppState, Event, DerivedState } from './types';

export class SonechkaApp {
  private stateManager: AppStateManager;
  private fileStorage: FileStorage;
  private saveDebounceTimer: number | null = null;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.fileStorage = new FileStorage();
    this.stateManager = new AppStateManager();
    
    // Setup broadcast channel for multi-tab synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('sonechka_os');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'state_update') {
          // In a real implementation, we might need to reload state from file
          console.log('State updated from another tab');
        }
      };
    }
    
    // Setup auto-save on blur
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => {
        this.debouncedSave();
      });
    }
  }

  // Initialize the app with file storage
  async initialize(): Promise<void> {
    try {
      await this.fileStorage.initialize();
      
      // Load existing state if available
      const savedState = await this.fileStorage.loadState();
      if (savedState) {
        this.stateManager = new AppStateManager(savedState);
      }
      
      // Subscribe to state changes to enable auto-saving
      this.stateManager.subscribeToState(() => {
        this.debouncedSave();
      });
    } catch (error) {
      console.error('Failed to initialize app:', error);
      throw error;
    }
  }

  // Debounced save to avoid too frequent writes
  private debouncedSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    
    this.saveDebounceTimer = window.setTimeout(async () => {
      try {
        await this.saveState();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 1000); // 1 second debounce
  }

  // Save current state to file
  async saveState(): Promise<void> {
    if (this.fileStorage.isInitialized()) {
      const state = this.stateManager.getAppState();
      await this.fileStorage.saveState(state);
      
      // Notify other tabs about the update
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'state_update', timestamp: Date.now() });
      }
    }
  }

  // Create a backup of the current state
  async createBackup(): Promise<boolean> {
    const result = await this.fileStorage.createBackup();
    return result !== null;
  }

  // Get current derived state
  getCurrentState(): DerivedState {
    return this.stateManager.getDerivedState();
  }

  // Add an event to the system
  addEvent(event: Event): void {
    this.stateManager.addEvent(event);
  }

  // Get the app state manager
  getStateManager(): AppStateManager {
    return this.stateManager;
  }

  // Get the file storage handler
  getFileStorage(): FileStorage {
    return this.fileStorage;
  }

  // Clean up resources
  destroy(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
  }
}