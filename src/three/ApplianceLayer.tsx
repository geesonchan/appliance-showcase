import { SLOT_ORDER } from "../data/catalogue";
import { useSelection } from "../store/useSelection";
import { ApplianceModel } from "./ApplianceModel";

/** All six appliances, driven by the current package selection. */
export function ApplianceLayer() {
  const selection = useSelection();

  return (
    <group name="appliance-layer">
      {SLOT_ORDER.map((slotId) => {
        const appliance = selection[slotId];
        if (!appliance) return null;
        return (
          <ApplianceModel
            key={slotId}
            slot={slotId}
            category={appliance.category}
            finish={appliance.finish[0]}
          />
        );
      })}
    </group>
  );
}
