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

    const state = this.app.getCurrentState();
    const anchorItems = [];

    // Health anchors
    if (state.glucose.status === 'low' && state.glucose.last) {
      anchorItems.push({ name: `Глюкоза (${state.glucose.last.value})`, status: '🔴', type: 'glucose' });
    } else {
      // Add pending health ritual steps
      const morningRitual = state.rituals['ritual_morning_prep'];
      if (morningRitual && !morningRitual.completed) {
        const pendingStep = morningRitual.steps.find((step: any) => !step.completed);
        if (pendingStep) {
          anchorItems.push({ 
            name: pendingStep.name, 
            status: '⏳', 
            type: 'health',
            ritualId: 'ritual_morning_prep',
            stepId: pendingStep.id
          });
        }
      }
    }

    // Plant anchors
    if (state.anchors.plants) {
      const plant = state.plants[state.anchors.plants];
      if (plant) {
        let statusIcon = '✅';
        if (plant.riskLevel === 'high') statusIcon = '🔴';
        else if (plant.riskLevel === 'medium') statusIcon = '🟡';
        else if (plant.riskLevel === 'low') statusIcon = '🟢';
        
        anchorItems.push({ 
          name: plant.name, 
          status: statusIcon, 
          type: 'plant',
          plantId: plant.id
        });
      }
    }

    // Self-care anchors
    const makeupRitual = state.rituals['ritual_makeup'];
    if (makeupRitual && !makeupRitual.completed) {
      const pendingStep = makeupRitual.steps.find((step: any) => !step.completed);
      if (pendingStep) {
        anchorItems.push({ 
          name: pendingStep.name, 
          status: '⏳', 
          type: 'selfcare',
          ritualId: 'ritual_makeup',
          stepId: pendingStep.id
        });
      }
    }

    // Work anchors
    if (state.work.emailChecks < 2) { // Assuming 2 email checks per day on weekdays
      const today = new Date();
      const dayOfWeek = today.getDay();
      // Only show email anchor on weekdays (Monday=1 to Friday=5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        anchorItems.push({ name: 'Проверка почты', status: '⏳', type: 'work', ritualId: 'work_email' });
      }
    }

    // Limit to 5 anchors as per spec
    const limitedAnchors = anchorItems.slice(0, 5);

    this.anchorsContainer.innerHTML = limitedAnchors.map(anchor => `
      <div class="anchor-item" onclick="sonechkaUI.handleAnchorClick('${anchor.type}', '${anchor.ritualId || anchor.plantId || ''}', '${anchor.stepId || ''}')">
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

    // Check if all required anchors are completed
    // For now, check if morning ritual is completed and glucose is not low
    const morningRitual = state.rituals['ritual_morning_prep'];
    const eveningRitual = state.rituals['ritual_evening_prep'];
    
    // Check if all required health rituals are completed
    const healthRitualsComplete = morningRitual?.completed && eveningRitual?.completed;
    
    // Check if glucose is not critically low
    const glucoseOk = state.glucose.status !== 'low';
    
    // Check if required work tasks are done (email checks)
    const workComplete = state.work.emailChecks >= 2; // Assuming 2 checks per day
    
    // Enable button only if all required tasks are completed
    this.dayEndButton.disabled = !(healthRitualsComplete && glucoseOk && workComplete);
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
  
  public handleAnchorClick(type: string, id: string, stepId: string): void {
    if (type === 'plant' && id) {
      // Water the plant
      const event: Event = {
        type: "watering_done",
        ts: new Date().toISOString(),
        plantId: id
      };
      
      this.app.addEvent(event);
    } else if (type === 'glucose') {
      // Prompt for glucose measurement
      const glucoseValue = prompt('Введите уровень глюкозы:');
      if (glucoseValue !== null) {
        const value = parseFloat(glucoseValue);
        if (!isNaN(value)) {
          const event: Event = {
            type: "glucose_measured",
            ts: new Date().toISOString(),
            value: value
          };
          
          this.app.addEvent(event);
        }
      }
    } else if (type === 'health' || type === 'selfcare' || type === 'work') {
      // Complete the associated ritual step
      if (id && stepId) {
        this.markStepComplete(id, stepId);
      }
    }
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