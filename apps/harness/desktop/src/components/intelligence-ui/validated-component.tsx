import React from "react";
import {
  defineComponent,
  useIsStreaming,
  type ComponentRenderer,
} from "@openuidev/react-lang";
import type { z } from "zod/v4";
import { boundedValue, componentPropsForValidation } from "./schema";

/** OpenUI validates types permissively; enforce the full Zod contract at render time. */
export function defineValidatedComponent<T extends z.ZodObject>(config: {
  name: string;
  description: string;
  props: T;
  component: ComponentRenderer<z.infer<T>>;
}) {
  const View = config.component;
  return defineComponent({
    ...config,
    component: (args) => {
      const streaming = useIsStreaming();
      const valid =
        boundedValue(args.props) &&
        config.props.safeParse(componentPropsForValidation(args.props)).success;
      if (!valid) {
        // Missing props are expected while a component is being generated.
        if (streaming) return null;
        throw new Error(`Invalid ${config.name} component props`);
      }
      // Preserve element envelopes for renderNode and the official native renderers.
      return <View {...args} />;
    },
  });
}
