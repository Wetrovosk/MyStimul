// AppStateManager.ts - Core state management with event sourcing

import { AppState, Event, DerivedState, PlantState, RitualState, PlantProfile } from './types';

// Simple UUID v4 generator without external dependencies
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
          { id: "meal_breakfast", name: "Завтрак", completed: false, dependencies: [] },
          { id: "med_ki_1", name: "Йод", completed: false, dependencies: ["meal_breakfast"] },
          { id: "med_mg_2", name: "Магний", completed: false, dependencies: ["meal_breakfast"] },
          { id: "med_stimol_2", name: "Стимол", completed: false, dependencies: ["meal_breakfast"] },
          { id: "med_omega3", name: "Омега-3", completed: false, dependencies: ["meal_breakfast"] }
        ],
        dependencies: ["meal_breakfast"]
      },
      ritual_evening_prep: {
        id: "ritual_evening_prep",
        name: "Вечерняя подготовка",
        completed: false,
        steps: [
          { id: "meal_dinner", name: "Ужин", completed: false, dependencies: [] },
          { id: "eye_emoxipin_4", name: "Капли Эмоксипин", completed: false, dependencies: ["meal_dinner"] },
          { id: "med_ki_2", name: "Йод", completed: false, dependencies: ["meal_dinner", "eye_emoxipin_4"] }, // >=15 min after eye drops
          { id: "med_mg_3", name: "Магний", completed: false, dependencies: ["meal_dinner"] },
          { id: "med_stimol_3", name: "Стимол", completed: false, dependencies: ["meal_dinner"] },
          { id: "eye_midramax", name: "Капли Мидрамакс", completed: false, dependencies: ["meal_dinner"] },
          { id: "estraderm_evening", name: "Эстрожель (вечер)", completed: false, dependencies: ["meal_dinner"] }
        ],
        dependencies: ["meal_dinner"]
      },
      // Self-care rituals
      ritual_skin_care_morning: {
        id: "ritual_skin_care_morning",
        name: "Утренний уход за кожей",
        completed: false,
        steps: [
          { id: "skincare_step_1", name: "Очищение", completed: false, dependencies: ["estraderm_morning", "eye_drops_systane"] },
          { id: "skincare_step_2", name: "Тоник", completed: false, dependencies: ["skincare_step_1"] },
          { id: "skincare_step_3", name: "Сыворотка", completed: false, dependencies: ["skincare_step_2"] },
          { id: "skincare_step_4", name: "Крем", completed: false, dependencies: ["skincare_step_3"] }
        ],
        dependencies: ["estraderm_morning", "eye_drops_systane"]
      },
      ritual_makeup: {
        id: "ritual_makeup",
        name: "Макияж",
        completed: false,
        steps: [
          { id: "makeup_primer", name: "База под макияж", completed: false, dependencies: ["ritual_skin_care_morning"] },
          { id: "makeup_foundation", name: "Тональный крем", completed: false, dependencies: ["makeup_primer"] },
          { id: "makeup_blush", name: "Румяна", completed: false, dependencies: ["makeup_foundation"] },
          { id: "makeup_eyes", name: "Макияж глаз", completed: false, dependencies: ["makeup_foundation"] },
          { id: "makeup_lips", name: "Помада", completed: false, dependencies: ["makeup_eyes"] }
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
          { id: "evening_skincare_step_1", name: "Очищение", completed: false, dependencies: ["eye_midramax"] },
          { id: "evening_skincare_step_2", name: "Тоник", completed: false, dependencies: ["evening_skincare_step_1"] },
          { id: "evening_skincare_step_3", name: "Сыворотка", completed: false, dependencies: ["evening_skincare_step_2"] },
          { id: "evening_skincare_step_4", name: "Ночной крем", completed: false, dependencies: ["evening_skincare_step_3"] }
        ],
        dependencies: ["eye_midramax"]
      }
    };

    // Add workout rituals based on the specification
    const workoutRituals = {
      w1d3m: {
        id: "w1d3m",
        name: "Танцы антистресс",
        completed: false,
        trainer: "Илана Сухорукова",
        duration: 20,
        steps: [
          { id: "w1d3m_start", name: "Начать тренировку", completed: false }
        ]
      },
      w1d4m: {
        id: "w1d4m",
        name: "Зарядки без коврика",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 8,
        steps: [
          { id: "w1d4m_start", name: "Начать тренировку", completed: false }
        ]
      },
      w1d4d: {
        id: "w1d4d",
        name: "Секси денс",
        completed: false,
        trainer: "Маша Мерикка",
        duration: 20,
        steps: [
          { id: "w1d4d_start", name: "Начать тренировку", completed: false }
        ]
      },
      w1d5e: {
        id: "w1d5e",
        name: "ВЕЧЕР Зарядки для лица",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 10,
        steps: [
          { id: "w1d5e_eye_drops", name: "Капли Систейн", completed: false },
          { id: "w1d5e_start", name: "Начать тренировку", completed: false, dependencies: ["w1d5e_eye_drops"] }
        ]
      },
      w1d6e: {
        id: "w1d6e",
        name: "ДЕНЬ Работа с гиперлордозом",
        completed: false,
        trainer: "Кристина Вершинина",
        duration: 30,
        steps: [
          { id: "w1d6e_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w1d6e_start", name: "Начать тренировку", completed: false, dependencies: ["w1d6e_glucose_check"] }
        ]
      },
      w1d6g: {
        id: "w1d6g",
        name: "ВЕЧЕР Фейсфитнес",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 25,
        steps: [
          { id: "w1d6g_eye_drops", name: "Капли Систейн", completed: false },
          { id: "w1d6g_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w1d6g_start", name: "Начать тренировку", completed: false, dependencies: ["w1d6g_eye_drops", "w1d6g_glucose_check"] }
        ]
      },
      w2d1e: {
        id: "w2d1e",
        name: "ДЕНЬ Functional Core",
        completed: false,
        trainer: "Елизавета Прокудина",
        duration: 30,
        steps: [
          { id: "w2d1e_check_weights", name: "Проверить гантели 0.75 кг", completed: false },
          { id: "w2d1e_start", name: "Начать тренировку", completed: false, dependencies: ["w2d1e_check_weights"] }
        ]
      },
      w2d2e: {
        id: "w2d2e",
        name: "ДЕНЬ Йога для здоровой спины",
        completed: false,
        trainer: "Лера Буры",
        duration: 20,
        steps: [
          { id: "w2d2e_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w2d2e_start", name: "Начать тренировку", completed: false, dependencies: ["w2d2e_glucose_check"] }
        ]
      },
      w2d3m: {
        id: "w2d3m",
        name: "ДЕНЬ Упражнения на осанку",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 15,
        steps: [
          { id: "w2d3m_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w2d3m_start", name: "Начать тренировку", completed: false, dependencies: ["w2d3m_glucose_check"] }
        ]
      },
      w2d4m: {
        id: "w2d4m",
        name: "ВЕЧЕР Танцы для похудения",
        completed: false,
        trainer: "Илана Сухорукова",
        duration: 25,
        steps: [
          { id: "w2d4m_start", name: "Начать тренировку", completed: false }
        ]
      },
      w2d5e: {
        id: "w2d5e",
        name: "ДЕНЬ Пресс + ягодицы",
        completed: false,
        trainer: "Маша Мерикка",
        duration: 20,
        steps: [
          { id: "w2d5e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w2d6e: {
        id: "w2d6e",
        name: "ВЕЧЕР Тренировка на баланс",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 18,
        steps: [
          { id: "w2d6e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w2d6g: {
        id: "w2d6g",
        name: "ДЕНЬ Мягкая йога",
        completed: false,
        trainer: "Лера Буры",
        duration: 25,
        steps: [
          { id: "w2d6g_start", name: "Начать тренировку", completed: false }
        ]
      },
      w3d1e: {
        id: "w3d1e",
        name: "ВЕЧЕР Упражнения для спины",
        completed: false,
        trainer: "Кристина Вершинина",
        duration: 20,
        steps: [
          { id: "w3d1e_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w3d1e_start", name: "Начать тренировку", completed: false, dependencies: ["w3d1e_glucose_check"] }
        ]
      },
      w3d2e: {
        id: "w3d2e",
        name: "ДЕНЬ Танцы с элементами силовой",
        completed: false,
        trainer: "Маша Мерикка",
        duration: 30,
        steps: [
          { id: "w3d2e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w3d3m: {
        id: "w3d3m",
        name: "ВЕЧЕР Упражнения для шеи",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 12,
        steps: [
          { id: "w3d3m_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w3d3m_start", name: "Начать тренировку", completed: false, dependencies: ["w3d3m_glucose_check"] }
        ]
      },
      w3d4m: {
        id: "w3d4m",
        name: "ДЕНЬ Кардио тренировка",
        completed: false,
        trainer: "Илана Сухорукова",
        duration: 22,
        steps: [
          { id: "w3d4m_start", name: "Начать тренировку", completed: false }
        ]
      },
      w3d5e: {
        id: "w3d5e",
        name: "ВЕЧЕР Растяжка",
        completed: false,
        trainer: "Лера Буры",
        duration: 15,
        steps: [
          { id: "w3d5e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w3d6e: {
        id: "w3d6e",
        name: "ДЕНЬ Фейсфитнес",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 18,
        steps: [
          { id: "w3d6e_eye_drops", name: "Капли Систейн", completed: false },
          { id: "w3d6e_start", name: "Начать тренировку", completed: false, dependencies: ["w3d6e_eye_drops"] }
        ]
      },
      w3d6g: {
        id: "w3d6g",
        name: "ВЕЧЕР Танцы антистресс",
        completed: false,
        trainer: "Илана Сухорукова",
        duration: 20,
        steps: [
          { id: "w3d6g_start", name: "Начать тренировку", completed: false }
        ]
      },
      w4d1e: {
        id: "w4d1e",
        name: "ДЕНЬ Силовая тренировка",
        completed: false,
        trainer: "Маша Мерикка",
        duration: 35,
        steps: [
          { id: "w4d1e_check_weights", name: "Проверить гантели 0.75 кг", completed: false },
          { id: "w4d1e_start", name: "Начать тренировку", completed: false, dependencies: ["w4d1e_check_weights"] }
        ]
      },
      w4d2e: {
        id: "w4d2e",
        name: "ВЕЧЕР Упражнения для похудения",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 25,
        steps: [
          { id: "w4d2e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w4d3m: {
        id: "w4d3m",
        name: "ДЕНЬ Йога для гибкости",
        completed: false,
        trainer: "Лера Буры",
        duration: 30,
        steps: [
          { id: "w4d3m_start", name: "Начать тренировку", completed: false }
        ]
      },
      w4d4m: {
        id: "w4d4m",
        name: "ВЕЧЕР Упражнения на осанку",
        completed: false,
        trainer: "Кристина Вершинина",
        duration: 15,
        steps: [
          { id: "w4d4m_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w4d4m_start", name: "Начать тренировку", completed: false, dependencies: ["w4d4m_glucose_check"] }
        ]
      },
      w4d5e: {
        id: "w4d5e",
        name: "ДЕНЬ Танцы для тонуса",
        completed: false,
        trainer: "Илана Сухорукова",
        duration: 20,
        steps: [
          { id: "w4d5e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w4d6e: {
        id: "w4d6e",
        name: "ВЕЧЕР Пресс и ягодицы",
        completed: false,
        trainer: "Маша Мерикка",
        duration: 18,
        steps: [
          { id: "w4d6e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w4d6g: {
        id: "w4d6g",
        name: "ДЕНЬ Медитация и дыхание",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 15,
        steps: [
          { id: "w4d6g_start", name: "Начать тренировку", completed: false }
        ]
      },
      w5d1e: {
        id: "w5d1e",
        name: "ВЕЧЕР Йога для расслабления",
        completed: false,
        trainer: "Лера Буры",
        duration: 25,
        steps: [
          { id: "w5d1e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w5d2e: {
        id: "w5d2e",
        name: "ДЕНЬ Кардио и силовые",
        completed: false,
        trainer: "Илана Сухорукова",
        duration: 30,
        steps: [
          { id: "w5d2e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w5d3m: {
        id: "w5d3m",
        name: "ВЕЧЕР Упражнения для спины",
        completed: false,
        trainer: "Кристина Вершинина",
        duration: 20,
        steps: [
          { id: "w5d3m_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w5d3m_start", name: "Начать тренировку", completed: false, dependencies: ["w5d3m_glucose_check"] }
        ]
      },
      w5d4m: {
        id: "w5d4m",
        name: "ДЕНЬ Танцы для тела",
        completed: false,
        trainer: "Маша Мерикка",
        duration: 25,
        steps: [
          { id: "w5d4m_start", name: "Начать тренировку", completed: false }
        ]
      },
      w5d5e: {
        id: "w5d5e",
        name: "ВЕЧЕР Растяжка и расслабление",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 20,
        steps: [
          { id: "w5d5e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w5d6e: {
        id: "w5d6e",
        name: "ДЕНЬ Фейсфитнес",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 18,
        steps: [
          { id: "w5d6e_eye_drops", name: "Капли Систейн", completed: false },
          { id: "w5d6e_start", name: "Начать тренировку", completed: false, dependencies: ["w5d6e_eye_drops"] }
        ]
      },
      w5d6g: {
        id: "w5d6g",
        name: "ВЕЧЕР Тренировка на баланс",
        completed: false,
        trainer: "Лера Буры",
        duration: 18,
        steps: [
          { id: "w5d6g_start", name: "Начать тренировку", completed: false }
        ]
      },
      w6d1e: {
        id: "w6d1e",
        name: "ДЕНЬ Силовая тренировка",
        completed: false,
        trainer: "Маша Мерикка",
        duration: 35,
        steps: [
          { id: "w6d1e_check_weights", name: "Проверить гантели 0.75 кг", completed: false },
          { id: "w6d1e_start", name: "Начать тренировку", completed: false, dependencies: ["w6d1e_check_weights"] }
        ]
      },
      w6d2e: {
        id: "w6d2e",
        name: "ВЕЧЕР Упражнения для похудения",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 25,
        steps: [
          { id: "w6d2e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w6d3m: {
        id: "w6d3m",
        name: "ДЕНЬ Йога для гибкости",
        completed: false,
        trainer: "Лера Буры",
        duration: 30,
        steps: [
          { id: "w6d3m_start", name: "Начать тренировку", completed: false }
        ]
      },
      w6d4m: {
        id: "w6d4m",
        name: "ВЕЧЕР Упражнения на осанку",
        completed: false,
        trainer: "Кристина Вершинина",
        duration: 15,
        steps: [
          { id: "w6d4m_glucose_check", name: "Проверить глюкозу ≥ 4.5", completed: false },
          { id: "w6d4m_start", name: "Начать тренировку", completed: false, dependencies: ["w6d4m_glucose_check"] }
        ]
      },
      w6d5e: {
        id: "w6d5e",
        name: "ДЕНЬ Танцы для тонуса",
        completed: false,
        trainer: "Илана Сухорукова",
        duration: 20,
        steps: [
          { id: "w6d5e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w6d6e: {
        id: "w6d6e",
        name: "ВЕЧЕР Пресс и ягодицы",
        completed: false,
        trainer: "Маша Мерикка",
        duration: 18,
        steps: [
          { id: "w6d6e_start", name: "Начать тренировку", completed: false }
        ]
      },
      w6d6g: {
        id: "w6d6g",
        name: "ДЕНЬ Медитация и дыхание",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 15,
        steps: [
          { id: "w6d6g_start", name: "Начать тренировку", completed: false }
        ]
      },
      w7d4h: {
        id: "w7d4h",
        name: "ВЕЧЕР Зарядки для лица",
        completed: false,
        trainer: "Иванна Идуш",
        duration: 10,
        steps: [
          { id: "w7d4h_eye_drops", name: "Капли Систейн", completed: false },
          { id: "w7d4h_start", name: "Начать тренировку", completed: false, dependencies: ["w7d4h_eye_drops"] }
        ]
      }
    };

    // Add workout rituals to the main rituals object
    Object.assign(rituals, workoutRituals);

    // Add development/work rituals
    const developmentRituals = {
      lecture: {
        id: "lecture",
        name: "Лекция",
        completed: false,
        steps: [
          { id: "lecture_done", name: "Посмотреть лекцию", completed: false }
        ],
        dependencies: []
      },
      practical: {
        id: "practical",
        name: "Практика",
        completed: false,
        steps: [
          { id: "practical_done", name: "Выполнить практику", completed: false }
        ],
        dependencies: []
      },
      zoo: {
        id: "zoo",
        name: "Зоопсихология",
        completed: false,
        steps: [
          { id: "zoo_done", name: "Занятие по зоопсихологии", completed: false }
        ],
        dependencies: []
      },
      fiction_ru: {
        id: "fiction_ru",
        name: "Худ. литература",
        completed: false,
        steps: [
          { id: "fiction_ru_done", name: "Прочитать главу", completed: false }
        ],
        dependencies: []
      },
      words: {
        id: "words",
        name: "Англ. слова",
        completed: false,
        steps: [
          { id: "words_learned", name: "Выучить 10 слов", completed: false }
        ],
        dependencies: []
      },
      soap: {
        id: "soap",
        name: "Мыловарение",
        completed: false,
        steps: [
          { id: "soap_session", name: "Сделать сессию", completed: false }
        ],
        dependencies: []
      },
      work_email: {
        id: "work_email",
        name: "Проверка почты",
        completed: false,
        steps: [
          { id: "work_email_check_1", name: "Первая проверка", completed: false },
          { id: "work_email_check_2", name: "Вторая проверка", completed: false }
        ],
        dependencies: [] // Will be handled by business logic
      },
      work_weekend: {
        id: "work_weekend",
        name: "Отметка выходного",
        completed: false,
        steps: [
          { id: "work_weekend_mark", name: "Отметить выходной", completed: false }
        ],
        dependencies: []
      }
    };

    Object.assign(rituals, developmentRituals);

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

    // Add development tracking
    const developmentCounters = {
      lecture: 0,
      practical: 0,
      zoo: 0,
      fiction_ru: 0,
      words: 0,
      soap: 0
    };
    
    // Add work tracking
    const workTracking = {
      emailChecks: 0,
      weekendMarked: false
    };
    
    // Process all events to update the state
    for (const event of this.state.events) {
      if (event.type === "ritual_step_completed") {
        // Count development activities
        switch(event.stepId) {
          case "lecture_done":
            developmentCounters.lecture += 1;
            break;
          case "practical_done":
            developmentCounters.practical += 1;
            break;
          case "zoo_done":
            developmentCounters.zoo += 1;
            break;
          case "fiction_ru_done":
            // Fiction_ru is counted by pages/lines, would need additional event data
            developmentCounters.fiction_ru += 1;
            break;
          case "words_learned":
            developmentCounters.words += 1;
            break;
          case "soap_session":
            developmentCounters.soap += 1;
            break;
          case "work_email_check_1":
          case "work_email_check_2":
            workTracking.emailChecks += 1;
            break;
          case "work_weekend_mark":
            workTracking.weekendMarked = true;
            break;
        }
      }
      
      switch (event.type) {
        case "ritual_step_completed":
          // Update the specific step as completed
          if (rituals[event.ritualId]) {
            const step = rituals[event.ritualId].steps.find(s => s.id === event.stepId);
            if (step) {
              // Check if all dependencies for this step are completed
              const dependenciesMet = step.dependencies ? 
                step.dependencies.every(depId => {
                  // Check if the dependency is a step in the same ritual
                  const depStep = rituals[event.ritualId].steps.find(s => s.id === depId);
                  if (depStep) return depStep.completed;
                  
                  // Check if the dependency is a ritual
                  if (rituals[depId]) return rituals[depId].completed;
                  
                  // If dependency not found, consider it as completed
                  return true;
                }) : true;
              
              if (dependenciesMet) {
                step.completed = true;
                
                // Check if all steps in the ritual are completed
                const allStepsCompleted = rituals[event.ritualId].steps.every(s => {
                  return s.completed;
                });
                rituals[event.ritualId].completed = allStepsCompleted;
              }
            }
          }
          break;

        case "med_taken":
          // Handle medication events
          break;

        case "med_taken":
          // Handle medication events
          // For now, just acknowledge the event. More complex logic could be added for timing constraints.
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
            
            // Mark systane drops as completed in w1d5e and w1d6g rituals
            const faceRitual1 = rituals["w1d5e"];
            if (faceRitual1) {
              const systaneStep1 = faceRitual1.steps.find(s => s.id === "w1d5e_eye_drops");
              if (systaneStep1) systaneStep1.completed = true;
            }
            
            const faceRitual2 = rituals["w1d6g"];
            if (faceRitual2) {
              const systaneStep2 = faceRitual2.steps.find(s => s.id === "w1d6g_eye_drops");
              if (systaneStep2) systaneStep2.completed = true;
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
            
            // Mark midramax drops as completed for evening care ritual dependency
            const eveningCareRitual = rituals["ritual_evening_care"];
            if (eveningCareRitual) {
              // The dependency is already handled by the step dependency system
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
          
          // When glucose is low, certain medications should be blocked
          // This would be handled in the UI layer by checking glucose.status
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
    
    // Add more sophisticated anchor logic based on the specification
    // Check for pending morning ritual steps
    const morningRitual = rituals["ritual_morning_prep"];
    if (morningRitual && !morningRitual.completed) {
      const pendingStep = morningRitual.steps.find(step => !step.completed);
      if (pendingStep) {
        anchors.health = pendingStep.id; // This could be estraderm_morning, eye_drops_systane, etc.
      }
    }
    
    // Check for pending plant watering
    if (!anchors.plants) {
      for (const plantId in plants) {
        if (plants[plantId].riskLevel === "medium") {
          anchors.plants = plantId;
          break;
        }
      }
    }

    return {
      today,
      rituals,
      plants,
      glucose,
      anchors,
      overdueCount,
      development: developmentCounters,
      work: workTracking
    };
  }
}