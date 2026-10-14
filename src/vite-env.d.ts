/// <reference types="vite/client" />
/// <reference types="@react-three/fiber" />

/** The commit this build was made from; see the `define` in vite.config.ts. */
declare const __COMMIT__: string;

/** The visit counter's address, set only by the workflow for this repository (D24). */
interface ImportMetaEnv {
  readonly VITE_GOATCOUNTER?: string;
}
