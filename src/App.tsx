import { PinOverlay } from "./ui/PinOverlay";
import { Scene } from "./three/Scene";

export default function App() {
  return (
    <div className="relative h-full w-full">
      <Scene />
      <PinOverlay />
    </div>
  );
}
