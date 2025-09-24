import { createMachine, Hyperstate, inferActions } from './index';

// Demo: Creating a typed state machine
const todoMachine = createMachine({
  initial: 'idle' as const,
  context: {
    todos: [] as Array<{ id: string; text: string; completed: boolean }>,
    filter: 'all' as 'all' | 'active' | 'completed',
    user: {
      id: '',
      name: '',
      preferences: {
        theme: 'light' as 'light' | 'dark',
        autoSave: true
      }
    }
  },
  states: {
    idle: {
      on: {
        ADD_TODO: {
          target: 'idle',
          action: (ctx, todo: { text: string }) => {
            // ctx is fully typed! IntelliSense will work perfectly here
            ctx.todos.push({
              id: Math.random().toString(),
              text: todo.text,
              completed: false
            });
          }
        },
        TOGGLE_TODO: {
          target: 'idle',
          action: (ctx, todoId: string) => {
            const todo = ctx.todos.find(t => t.id === todoId);
            if (todo) {
              todo.completed = !todo.completed;
            }
          }
        },
        SET_FILTER: {
          target: 'idle',
          action: (ctx, filter: 'all' | 'active' | 'completed') => {
            ctx.filter = filter;
          }
        },
        LOGIN_USER: {
          target: 'idle',
          action: (ctx, user: { id: string; name: string }) => {
            ctx.user.id = user.id;
            ctx.user.name = user.name;
          }
        },
        UPDATE_THEME: {
          target: 'idle',
          action: (ctx, theme: 'light' | 'dark') => {
            ctx.user.preferences.theme = theme;
          }
        }
      }
    }
  }
});

// Extract action signatures for external use
type TodoActions = ReturnType<typeof inferActions<typeof todoMachine>>;
// This will be:
// {
//   ADD_TODO: { text: string };
//   TOGGLE_TODO: string;
//   SET_FILTER: 'all' | 'active' | 'completed';
//   LOGIN_USER: { id: string; name: string };
//   UPDATE_THEME: 'light' | 'dark';
// }

// Function that safely works with the machine
function createTodoHelper(hyperstate: Hyperstate<typeof todoMachine>) {
  return {
    addTodo: (text: string) =>
      hyperstate.action('ADD_TODO', { text }),

    toggleTodo: (id: string) =>
      hyperstate.action('TOGGLE_TODO', id),

    setFilter: (filter: 'all' | 'active' | 'completed') =>
      hyperstate.action('SET_FILTER', filter),

    getFilteredTodos: () => {
      const { todos, filter } = hyperstate.context;
      switch (filter) {
        case 'active': return todos.filter(t => !t.completed);
        case 'completed': return todos.filter(t => t.completed);
        default: return todos;
      }
    },

    // Type-safe access to context
    getStats: () => ({
      total: hyperstate.context.todos.length,
      completed: hyperstate.context.todos.filter(t => t.completed).length,
      active: hyperstate.context.todos.filter(t => !t.completed).length
    })
  };
}

export { todoMachine, createTodoHelper, type TodoActions };
