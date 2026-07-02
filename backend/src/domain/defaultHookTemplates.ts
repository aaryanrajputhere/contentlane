import type { HookTemplateInput } from './schemas';

export const defaultHookTemplates: HookTemplateInput[] = [
  {
    title: 'Mess vs. Masterpiece',
    text: 'The difference becomes obvious in seconds',
    templateType: 'Mess vs. Masterpiece',
    sceneDurationSeconds: 2,
    sortOrder: 10,
    isActive: true,
    scenes: [
      { purpose: 'Establish the visible mess', context: 'Show the product category problem before the product is used', requiredVisualChange: 'Add or reveal one wrong item, clutter, poor fit, or failed setup so the scene ends worse than it starts', overlayTextDirection: 'Short problem statement' },
      { purpose: 'Escalate the failed workaround', context: 'Continue from the same messy setup', requiredVisualChange: 'Try a workaround or awkward placement that makes the problem clearer', overlayTextDirection: 'Name the failed attempt' },
      { purpose: 'Introduce the product', context: 'The setup is cleared enough for the referenced product to enter', requiredVisualChange: 'Place, reveal, unpack, or switch on the exact product from the reference image', overlayTextDirection: 'Name the product as the fix' },
      { purpose: 'Show one concrete product detail', context: 'The referenced product is already placed from Scene 3', requiredVisualChange: 'Adjust, rotate, open, switch, or use one visible feature or material detail', overlayTextDirection: 'Call out the visible benefit' },
      { purpose: 'Reveal the finished result', context: 'Return to the same area or use case from Scene 1', requiredVisualChange: 'Pull back or reveal a cleaner, better arranged final state anchored by the product', overlayTextDirection: 'Final payoff or CTA' },
    ],
  },
  {
    title: 'Contrarian Angle',
    text: 'The obvious choice is not always the better one',
    templateType: 'Contrarian Angle',
    sceneDurationSeconds: 2,
    sortOrder: 20,
    isActive: true,
    scenes: [
      { purpose: 'Show the common assumption', context: 'Open on the obvious alternative or default setup the audience expects', requiredVisualChange: 'A hand selects or places the common option and exposes a visible limitation', overlayTextDirection: 'Everyone picks this first' },
      { purpose: 'Challenge the assumption', context: 'Stay in the same setup with the limitation still visible', requiredVisualChange: 'Compare the alternative against the product category problem through a physical side-by-side or failed use', overlayTextDirection: 'But it misses this' },
      { purpose: 'Reveal the product-specific reason', context: 'Bring in the exact referenced product as the counterpoint', requiredVisualChange: 'Place or use the referenced product in the same spot where the common option failed', overlayTextDirection: 'This is the difference' },
      { purpose: 'Prove the contrarian claim visually', context: 'The referenced product is already in use', requiredVisualChange: 'Demonstrate one visible detail, fit, mechanism, finish, or result that supports the claim', overlayTextDirection: 'Look at the detail' },
      { purpose: 'Resolve with the better choice', context: 'Return to the comparison setup', requiredVisualChange: 'Remove or de-emphasize the common option and leave the referenced product as the clear finished choice', overlayTextDirection: 'Choose the better fit' },
    ],
  },
  {
    title: 'Value Stacker',
    text: 'Three details make this worth it',
    templateType: 'Value Stacker',
    sceneDurationSeconds: 2,
    sortOrder: 30,
    isActive: true,
    scenes: [
      { purpose: 'Open with the product promise', context: 'Start on the product category use case before the product is fully revealed', requiredVisualChange: 'Reveal the exact referenced product entering the setup', overlayTextDirection: 'Three details matter' },
      { purpose: 'Show value point one', context: 'The referenced product is visible and ready to use', requiredVisualChange: 'Use or adjust the first visible feature, material, or fit detail', overlayTextDirection: 'Detail one' },
      { purpose: 'Show value point two', context: 'Continue from the first demonstrated detail', requiredVisualChange: 'Change angle or action to reveal a second concrete benefit or use case', overlayTextDirection: 'Detail two' },
      { purpose: 'Show value point three', context: 'The product remains in the same setup', requiredVisualChange: 'Demonstrate a third visible reason through motion, arrangement, or finished result', overlayTextDirection: 'Detail three' },
      { purpose: 'Stack the payoff into a CTA', context: 'All three details have been shown', requiredVisualChange: 'Pull back to a completed setup with the referenced product clearly anchoring the frame', overlayTextDirection: 'Shop the full upgrade' },
    ],
  },
];
