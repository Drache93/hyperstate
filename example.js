import Corestore from "corestore";
import { Coremachine, createMachine } from "./dist/index.js";

const todoMachine = createMachine({
  initial: "idle",
  context: {
    todos: [],
    filter: "all",
    user: {
      id: "",
      name: "",
      preferences: {
        theme: "light",
        autoSave: true,
      },
    },
  },
  states: {
    idle: {
      on: {
        ADD_TODO: {
          target: "idle",
          action: (ctx, todo) => {
            // ctx is fully typed! IntelliSense will work perfectly here
            ctx.todos.push({
              id: Math.random().toString(),
              text: todo.text,
              completed: false,
            });
          },
        },
        TOGGLE_TODO: {
          target: "idle",
          action: (ctx, todoId) => {
            const todo = ctx.todos.find((t) => t.id === todoId);
            if (todo) {
              todo.completed = !todo.completed;
            }
          },
        },
        SET_FILTER: {
          target: "idle",
          action: (ctx, filter) => {
            ctx.filter = filter;
          },
        },
        LOGIN_USER: {
          target: "idle",
          action: (ctx, user) => {
            ctx.user.id = user.id;
            ctx.user.name = user.name;
          },
        },
        UPDATE_THEME: {
          target: "idle",
          action: (ctx, theme) => {
            ctx.user.preferences.theme = theme;
          },
        },
      },
    },
  },
});

const store = new Corestore("./store1");
const coremachine = new Coremachine(
  store.get({ name: "coremachine", valueEncoding: "json" }),
  todoMachine,
);

coremachine.on("data", (data) => {
  // every time you run this script you'll see more todos!
  console.log("state changed!", data);
});

coremachine.write({ action: "ADD_TODO", value: { todo: { text: "hello!" } } });
