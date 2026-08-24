import { registerRootComponent } from "expo";

import App from "./App";

// registerRootComponent handles both Expo Go and native builds,
// and sets up the correct environment (dev/prod) for either.
registerRootComponent(App);
