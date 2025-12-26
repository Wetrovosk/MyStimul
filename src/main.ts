// main.ts - Entry point for the Sonechka.OS application

import { SonechkaApp } from './SonechkaApp';
import { Event } from './types';

class SonechkaUI {
  private app: SonechkaApp;
  private saveStatusIndicator: HTMLElement | null;
  private saveButton: HTMLButtonElement | null;
  private anchorsContainer: HTMLElement | null;
  private ritualsContainer: HTMLElement | null;
  private dayEndButton: HTMLButtonElement | null;

  constructor() {
    this.app = new SonechkaApp();
    this.saveStatusIndicator = null;
    this.saveButton = null;
    this.anchorsContainer = null;
    this.ritualsContainer = null;
    this.dayEndButton = null;

    this.initializeElements();
    this.setupEventListeners();
    this.initializeApp();
  }

  private initializeElements(): void {
    this.saveStatusIndicator = document.querySelector('.status-indicator');
    this.saveButton = document.getElementById('save-btn') as HTMLButtonElement;
    this.anchorsContainer = document.getElementById('anchors-container');
    this.ritualsContainer = document.getElementById('rituals-container');
    this.dayEndButton = document.getElementById('day-end-btn') as HTMLButtonElement;
  }

  private setupEventListeners(): void {
    if (this.saveButton) {
      this.saveButton.addEventListener('click', async () => {
        try {
          await this.app.saveState();
          this.updateSaveStatus('saved');
        } catch (error) {
          console.error('Manual save failed:', error);
          this.updateSaveStatus('error');
        }
      });
    }
  }

  private async initializeApp(): Promise<void> {
    try {
      await this.app.initialize();
      this.updateUI();
      
      // Subscribe to state changes to update UI automatically
      this.app.getStateManager().subscribeToState(() => {
        this.updateUI();
      });
      
      this.updateSaveStatus('saved');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.updateSaveStatus('error');
    }
  }

  private updateUI(): void {
    const state = this.app.getCurrentState();
    this.renderAnchors(state.anchors);
    this.renderRituals(state.rituals);
    this.updateDayEndButton(state);
  }

  private renderAnchors(anchors: { selfcare?: string; plants?: string; health?: string }): void {
    if (!this.anchorsContainer) return;

    // For now, just show placeholder anchors
    const anchorItems = [
      { name: 'Эстрожель (утро)', status: '⏳' },
      { name: 'Монстера', status: '🔴' },
      { name: 'Нежные зарядки', status: '✅' },
      { name: 'Глюкоза', status: '🟡 4.1' },
      { name: 'Почта', status: '✅' }
    ];

    this.anchorsContainer.innerHTML = anchorItems.map(anchor => `
      <div class="anchor-item">
        <span class="anchor-name">${anchor.name}</span>
        <span class="anchor-status">${anchor.status}</span>
      </div>
    `).join('');
  }

  private renderRituals(rituals: Record<string, any>): void {
    if (!this.ritualsContainer) return;

    // Get only incomplete rituals to show
    const incompleteRituals = Object.values(rituals).filter((ritual: any) => !ritual.completed);

    this.ritualsContainer.innerHTML = incompleteRituals.map((ritual: any) => {
      const incompleteSteps = ritual.steps.filter((step: any) => !step.completed);
      
      return `
        <div class="ritual-card">
          <div class="ritual-header">
            <h3>${ritual.name}</h3>
            <span>${ritual.completed ? '✅' : '⏳'}</span>
          </div>
          <div class="ritual-steps">
            ${incompleteSteps.map((step: any) => `
              <div class="step-item">
                <span class="step-name">${step.name}</span>
                <span class="step-status">${step.completed ? '✅' : '⏳'}</span>
                <button onclick="sonechkaUI.markStepComplete('${ritual.id}', '${step.id}')">Выполнить</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  private updateDayEndButton(state: any): void {
    if (!this.dayEndButton) return;

    // For now, just enable the button after a delay to simulate checking
    // In a real implementation, this would check if all required anchors are completed
    setTimeout(() => {
      this.dayEndButton!.disabled = false;
    }, 1000);
  }

  private updateSaveStatus(status: 'saving' | 'saved' | 'error'): void {
    if (!this.saveStatusIndicator) return;

    // Reset classes
    this.saveStatusIndicator.className = 'status-indicator';
    
    switch (status) {
      case 'saving':
        this.saveStatusIndicator.classList.add('status-yellow');
        break;
      case 'saved':
        this.saveStatusIndicator.classList.add('status-green');
        break;
      case 'error':
        this.saveStatusIndicator.classList.add('status-red');
        break;
    }
  }

  public markStepComplete(ritualId: string, stepId: string): void {
    const event: Event = {
      type: "ritual_step_completed",
      ts: new Date().toISOString(),
      ritualId,
      stepId
    };
    
    this.app.addEvent(event);
  }
}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Initialize the app when the DOM is loaded
let sonechkaUI: SonechkaUI;

document.addEventListener('DOMContentLoaded', () => {
  sonechkaUI = new SonechkaUI();
});