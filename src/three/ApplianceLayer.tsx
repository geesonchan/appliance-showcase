import { SLOT_ORDER } from "../data/catalogue";
import { isOmitted } from "../data/slots";
import { useSelection } from "../store/useSelection";
import { ApplianceModel } from "./ApplianceModel";

/**
 * The appliances in the room, driven by the current package selection.
 *
 * A slot the room was built without draws nothing: see `OMITTED_SLOTS`.
 */
export function ApplianceLayer() {
  const selection = useSelection();

  return (
    <group name="appliance-layer">
      {SLOT_ORDER.map((slotId) => {
        const appliance = selection[slotId];
        if (!appliance || isOmitted(slotId)) return null;
        return <ApplianceModel key={slotId} slot={slotId} appliance={appliance} />;
      })}
    </group>
  );
}
