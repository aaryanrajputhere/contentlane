import React from 'react';

interface StepperProps {
  currentStep: number;
  completedSteps: Set<number>;
}

const STEPS = [
  { num: 1, label: 'Characters' },
  { num: 2, label: 'Script' },
  { num: 3, label: 'Voiceover' },
  { num: 4, label: 'Render' },
];

const Stepper: React.FC<StepperProps> = ({ currentStep, completedSteps }) => {
  return (
    <div className="flex items-center justify-center gap-2 mb-12">
      {STEPS.map((step, i) => {
        const isActive = currentStep === step.num;
        const isCompleted = completedSteps.has(step.num);

        return (
          <React.Fragment key={step.num}>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 ${
                  isActive
                    ? 'bg-dodgerblue border-dodgerblue text-black shadow-[0_0_20px_rgba(48,128,255,0.4)]'
                    : isCompleted
                    ? 'bg-dodgerblue/20 border-dodgerblue text-dodgerblue'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                }`}
              >
                {isCompleted ? '✓' : step.num}
              </div>
              <span
                className={`hidden sm:block text-xs font-black uppercase tracking-widest transition-colors ${
                  isActive ? 'text-white' : isCompleted ? 'text-dodgerblue' : 'text-zinc-600'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 h-[2px] mx-2 transition-colors duration-300 ${
                  completedSteps.has(step.num) ? 'bg-dodgerblue' : 'bg-zinc-900'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Stepper;
