// FileStorage.ts - File system access for Sonechka.OS

import { AppState } from './types';

export class FileStorage {
  private stateFileHandle: FileSystemFileHandle | null = null;
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  // Initialize with directory picker
  async initialize(): Promise<void> {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        this.directoryHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        
        // Try to get existing state file or create a new one
        try {
          this.stateFileHandle = await this.directoryHandle.getFileHandle('sonechka.state.json', { create: true });
        } catch (error) {
          console.error('Error accessing state file:', error);
          throw error;
        }
      } catch (error) {
        console.error('Directory picker cancelled or failed:', error);
        throw error;
      }
    } else {
      throw new Error('File System Access API not supported in this browser');
    }
  }

  // Load state from file
  async loadState(): Promise<AppState | null> {
    if (!this.stateFileHandle) {
      throw new Error('File storage not initialized');
    }

    try {
      const file = await this.stateFileHandle.getFile();
      const contents = await file.text();
      
      if (contents.trim() === '') {
        return null;
      }
      
      return JSON.parse(contents);
    } catch (error) {
      console.error('Error loading state:', error);
      return null;
    }
  }

  // Save state to file
  async saveState(state: AppState): Promise<void> {
    if (!this.stateFileHandle) {
      throw new Error('File storage not initialized');
    }

    try {
      const writable = await this.stateFileHandle.createWritable();
      await writable.write(JSON.stringify(state, null, 2));
      await writable.close();
    } catch (error) {
      console.error('Error saving state:', error);
      throw error;
    }
  }

  // Create backup of current state
  async createBackup(): Promise<string | null> {
    if (!this.directoryHandle) {
      throw new Error('File storage not initialized');
    }

    try {
      // Create backups directory if it doesn't exist
      let backupsDirHandle: FileSystemDirectoryHandle;
      try {
        backupsDirHandle = await this.directoryHandle.getDirectoryHandle('backups', { create: true });
      } catch (error) {
        console.error('Error creating backups directory:', error);
        return null;
      }

      // Generate filename with current date
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const fileName = `sonechka_${dateStr}.json`;
      
      try {
        const backupFileHandle = await backupsDirHandle.getFileHandle(fileName, { create: true });
        const writable = await backupFileHandle.createWritable();
        
        // Load current state and write to backup
        const currentState = await this.loadState();
        if (currentState) {
          await writable.write(JSON.stringify(currentState, null, 2));
          await writable.close();
          
          // Add backup event to main state
          // (This would be handled by the app manager in actual implementation)
          
          return fileName;
        }
        return null;
      } catch (error) {
        console.error('Error creating backup:', error);
        return null;
      }
    } catch (error) {
      console.error('Error during backup process:', error);
      return null;
    }
  }

  // Check if storage is initialized
  isInitialized(): boolean {
    return this.stateFileHandle !== null && this.directoryHandle !== null;
  }
}