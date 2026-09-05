import { APPLIANCE_BY_SLOT, SLOT_ORDER } from "../data/appliances";
import { ApplianceModel } from "./ApplianceModel";

/** All six appliances, driven by the current package selection. */
export function ApplianceLayer() {
  return (
    <group name="appliance-layer">
      {SLOT_ORDER.map((slotId) => {
        const appliance = APPLIANCE_BY_SLOT[slotId];
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
