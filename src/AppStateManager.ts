// AppStateManager.ts - Core state management with event sourcing

import { AppState, Event, DerivedState, PlantState, RitualState, PlantProfile } from './types';
import { v4 as uuidv4 } from 'uuid';

export class AppStateManager {
  private state: AppState;
  private eventListeners: Array<(event: Event) => void> = [];
  private stateListeners: Array<(state: DerivedState) => void> = [];

  constructor(initialState?: AppState) {
    if (initialState) {
      this.state = initialState;
    } else {
      this.state = {
        version: "1.0",
        lastSaved: new Date().toISOString(),
        events: [],
        meta: {
          userId: uuidv4(),
          deviceName: typeof window !== 'undefined' ? navigator.userAgent : 'server'
        }
      };
      
      // Add initial app_init event
      this.addEvent({
        type: "app_init",
        ts: new Date().toISOString()
      });
    }
  }

  // Add a new event to the event log
  public addEvent(event: Event): void {
    this.state.events.push(event);
    this.state.lastSaved = new Date().toISOString();
    
    // Notify event listeners
    for (const listener of this.eventListeners) {
      listener(event);
    }
    
    // Notify state listeners about the change
    const derivedState = this.deriveState();
    for (const listener of this.stateListeners) {
      listener(derivedState);
    }
  }

  // Get the current derived state
  public getDerivedState(): DerivedState {
    return this.deriveState();
  }

  // Get the raw app state
  public getAppState(): AppState {
    return this.state;
  }

  // Subscribe to events
  public subscribeToEvents(callback: (event: Event) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      const index = this.eventListeners.indexOf(callback);
      if (index !== -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  // Subscribe to state changes
  public subscribeToState(callback: (state: DerivedState) => void): () => void {
    this.stateListeners.push(callback);
    return () => {
      const index = this.stateListeners.indexOf(callback);
      if (index !== -1) {
        this.stateListeners.splice(index, 1);
      }
    };
  }

  // Calculate derived state from events
  private deriveState(): DerivedState {
    // Initialize with default values
    const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // Initialize default rituals
    const rituals: Record<string, RitualState> = {
      // Health rituals
      ritual_morning_prep: {
        id: "ritual_morning_prep",
        name: "Утренняя подготовка",
        completed: false,
        steps: [
          { id: "eye_drops_systane", name: "Капли Систейн", completed: false },
          { id: "estraderm_morning", name: "Эстрожель (утро)", completed: false },
          { id: "med_fortedertrim", name: "Фортедер.trim", completed: false },
          { id: "med_folic", name: "Фолиевая кислота", completed: false },
          { id: "med_mg_1", name: "Магний", completed: false }
        ]
      },
      ritual_lunch_prep: {
        id: "ritual_lunch_prep",
        name: "Обеденная подготовка",
        completed: false,
        steps: [
          { id: "meal_breakfast", name: "Завтрак", completed: false },
          { id: "med_ki_1", name: "Йод", completed: false },
          { id: "med_mg_2", name: "Магний", completed: false },
          { id: "med_stimol_2", name: "Стимол", completed: false },
          { id: "med_omega3", name: "Омега-3", completed: false }
        ],
        dependencies: ["meal_breakfast"]
      },
      ritual_evening_prep: {
        id: "ritual_evening_prep",
        name: "Вечерняя подготовка",
        completed: false,
        steps: [
          { id: "meal_dinner", name: "Ужин", completed: false },
          { id: "eye_emoxipin_4", name: "Капли Эмоксипин", completed: false },
          { id: "med_ki_2", name: "Йод", completed: false },
          { id: "med_mg_3", name: "Магний", completed: false },
          { id: "med_stimol_3", name: "Стимол", completed: false },
          { id: "eye_midramax", name: "Капли Мидрамакс", completed: false },
          { id: "estraderm_evening", name: "Эстрожель (вечер)", completed: false }
        ],
        dependencies: ["meal_dinner"]
      },
      // Self-care rituals
      ritual_skin_care_morning: {
        id: "ritual_skin_care_morning",
        name: "Утренний уход за кожей",
        completed: false,
        steps: [
          { id: "skincare_step_1", name: "Очищение", completed: false },
          { id: "skincare_step_2", name: "Тоник", completed: false },
          { id: "skincare_step_3", name: "Сыворотка", completed: false },
          { id: "skincare_step_4", name: "Крем", completed: false }
        ],
        dependencies: ["estraderm_morning", "eye_drops_systane"]
      },
      ritual_makeup: {
        id: "ritual_makeup",
        name: "Макияж",
        completed: false,
        steps: [
          { id: "makeup_primer", name: "База под макияж", completed: false },
          { id: "makeup_foundation", name: "Тональный крем", completed: false },
          { id: "makeup_blush", name: "Румяна", completed: false },
          { id: "makeup_eyes", name: "Макияж глаз", completed: false },
          { id: "makeup_lips", name: "Помада", completed: false }
        ],
        dependencies: ["ritual_skin_care_morning"]
      },
      ritual_dental: {
        id: "ritual_dental",
        name: "Чистка зубов",
        completed: false,
        steps: [
          { id: "dental_brush", name: "Чистка зубов", completed: false },
          { id: "dental_floss", name: "Зубная нить", completed: false },
          { id: "dental_mouthwash", name: "Ополаскиватель", completed: false }
        ]
      },
      ritual_evening_care: {
        id: "ritual_evening_care",
        name: "Вечерний уход",
        completed: false,
        steps: [
          { id: "evening_skincare_step_1", name: "Очищение", completed: false },
          { id: "evening_skincare_step_2", name: "Тоник", completed: false },
          { id: "evening_skincare_step_3", name: "Сыворотка", completed: false },
          { id: "evening_skincare_step_4", name: "Ночной крем", completed: false }
        ],
        dependencies: ["eye_midramax"]
      }
    };

    // Initialize default plants
    const plants: Record<string, PlantState> = {
      plant_schefflera_gerda: {
        id: "plant_schefflera_gerda",
        name: "Шеффлера Герда",
        profile: {
          baseInterval: [7, 10],
          winterMultiplier: 1.3,
          criticality: 3
        },
        nextDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_schefflera_nora: {
        id: "plant_schefflera_nora",
        name: "Шеффлера Нора",
        profile: {
          baseInterval: [8, 12],
          winterMultiplier: 1.3,
          criticality: 3
        },
        nextDue: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_ficus_elastica: {
        id: "plant_ficus_elastica",
        name: "Фикус эластика",
        profile: {
          baseInterval: [10, 14],
          winterMultiplier: 1.2,
          criticality: 4
        },
        nextDue: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_monstera: {
        id: "plant_monstera",
        name: "Монстера",
        profile: {
          baseInterval: [6, 9],
          winterMultiplier: 1.1,
          humidityMultiplier: 0.8, // reacts to humidity < 40%
          criticality: 4
        },
        nextDue: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_nolina: {
        id: "plant_nolina",
        name: "Нолина",
        profile: {
          baseInterval: [21, 28],
          winterMultiplier: 1.0,
          criticality: 1
        },
        nextDue: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_dracena: {
        id: "plant_dracena",
        name: "Драцена",
        profile: {
          baseInterval: [7, 10],
          winterMultiplier: 1.3,
          criticality: 3
        },
        nextDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_peperomia: {
        id: "plant_peperomia",
        name: "Пеперомия",
        profile: {
          baseInterval: [10, 14],
          winterMultiplier: 1.2,
          criticality: 2
        },
        nextDue: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_yucca_big: {
        id: "plant_yucca_big",
        name: "Юкка большая",
        profile: {
          baseInterval: [14, 21],
          winterMultiplier: 1.0,
          criticality: 1
        },
        nextDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_yucca_small: {
        id: "plant_yucca_small",
        name: "Юкка маленькая",
        profile: {
          baseInterval: [14, 21],
          winterMultiplier: 1.0,
          criticality: 2
        },
        nextDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_philodendron: {
        id: "plant_philodendron",
        name: "Филодендрон",
        profile: {
          baseInterval: [5, 7],
          winterMultiplier: 1.0,
          criticality: 3
        },
        nextDue: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      },
      plant_elka_conica: {
        id: "plant_elka_conica",
        name: "Ель коника",
        profile: {
          baseInterval: [10, 14],
          winterMultiplier: 1.0,
          criticality: 5 // highest criticality
        },
        nextDue: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        riskLevel: "low",
        isWinter: false
      }
    };

    // Initialize glucose state
    let glucose = {
      last: undefined as { value: number; ts: string } | undefined,
      status: "unknown" as "low" | "optimal" | "high" | "unknown"
    };

    // Process all events to update the state
    for (const event of this.state.events) {
      switch (event.type) {
        case "ritual_step_completed":
          // Update the specific step as completed
          if (rituals[event.ritualId]) {
            const step = rituals[event.ritualId].steps.find(s => s.id === event.stepId);
            if (step) {
              step.completed = true;
              
              // Check if all steps in the ritual are completed
              const allStepsCompleted = rituals[event.ritualId].steps.every(s => s.completed);
              rituals[event.ritualId].completed = allStepsCompleted;
            }
          }
          break;

        case "med_taken":
          // Handle medication events
          break;

        case "eye_drop_applied":
          // Handle eye drop events
          if (event.dropType === "systane") {
            // Mark systane drops as completed in morning ritual
            const morningRitual = rituals["ritual_morning_prep"];
            if (morningRitual) {
              const systaneStep = morningRitual.steps.find(s => s.id === "eye_drops_systane");
              if (systaneStep) systaneStep.completed = true;
            }
          } else if (event.dropType === "emoxipin") {
            // Mark emoxipin drops as completed in evening ritual
            const eveningRitual = rituals["ritual_evening_prep"];
            if (eveningRitual) {
              const emoxipinStep = eveningRitual.steps.find(s => s.id === "eye_emoxipin_4");
              if (emoxipinStep) emoxipinStep.completed = true;
            }
          } else if (event.dropType === "midramax") {
            // Mark midramax drops as completed in evening ritual
            const eveningRitual = rituals["ritual_evening_prep"];
            if (eveningRitual) {
              const midramaxStep = eveningRitual.steps.find(s => s.id === "eye_midramax");
              if (midramaxStep) midramaxStep.completed = true;
            }
          }
          break;

        case "watering_done":
          // Update plant watering state
          if (plants[event.plantId]) {
            const plant = plants[event.plantId];
            plant.lastWatered = event.ts;
            
            // Calculate next due date based on base interval
            const intervalDays = plant.profile.baseInterval[0]; // Using minimum interval for now
            const nextDueDate = new Date(event.ts);
            nextDueDate.setDate(nextDueDate.getDate() + intervalDays);
            plant.nextDue = nextDueDate.toISOString();
            
            // Update risk level based on current time vs next due date
            const now = new Date();
            const nextDue = new Date(plant.nextDue);
            const timeDiffHours = (nextDue.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            if (timeDiffHours > 12) {
              plant.riskLevel = "low";
            } else if (timeDiffHours > 0) {
              plant.riskLevel = "medium";
            } else {
              plant.riskLevel = "high";
            }
          }
          break;

        case "glucose_measured":
          glucose.last = { value: event.value, ts: event.ts };
          
          if (event.value < 4.2) {
            glucose.status = "low";
          } else if (event.value <= 6.0) {
            glucose.status = "optimal";
          } else {
            glucose.status = "high";
          }
          break;

        case "plant_profile_updated":
          // Update plant profile
          if (plants[event.plantId]) {
            plants[event.plantId].profile = event.profile;
          }
          break;

        case "app_init":
          // Initial event, no state changes needed
          break;

        case "focus_lost":
        case "backup_created":
          // Events that don't affect derived state
          break;
      }
    }

    // Calculate overdue count for plants
    let overdueCount = 0;
    const now = new Date();
    for (const plantId in plants) {
      const plant = plants[plantId];
      const nextDue = new Date(plant.nextDue);
      if (now > nextDue) {
        overdueCount++;
      }
    }

    // Determine anchors based on current state
    const anchors = {
      selfcare: undefined as string | undefined,
      plants: undefined as string | undefined,
      health: undefined as string | undefined
    };

    // Set health anchor based on glucose or pending medications
    if (glucose.last && glucose.status === "low") {
      anchors.health = "rest_teabreak";
    }

    // Set plant anchor if any plants are overdue
    for (const plantId in plants) {
      if (plants[plantId].riskLevel === "high") {
        anchors.plants = plantId;
        break;
      }
    }

    return {
      today,
      rituals,
      plants,
      glucose,
      anchors,
      overdueCount
    };
  }
}