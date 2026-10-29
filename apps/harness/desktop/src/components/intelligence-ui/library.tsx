import { createLibrary } from "@openuidev/react-lang";
import { definitions } from "./schema";
import { defineValidatedComponent } from "./validated-component";

export const intelligenceLibrary = createLibrary({
  root: "Stack",
  components: Object.values(definitions).map((definition) =>
    defineValidatedComponent(definition),
  ),
});
