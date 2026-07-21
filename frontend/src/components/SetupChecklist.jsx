import { ArrowRight, Check, CircleDashed } from 'lucide-react'

// Answers "how do I set up a camp?" without a manual. Shows the four things that
// must exist before the stand can sell, marks off what's done, and points at the
// next action. Disappears once everything is set up, so it never nags a running camp.
export default function SetupChecklist({ steps }) {
  const done = steps.filter((s) => s.done).length

  if (done === steps.length) return null // fully set up - get out of the way

  return (
    <section className="bg-white rounded-xl shadow-sm p-4 border border-primary/20">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-bold">Camp einrichten</h2>
          <p className="text-xs text-gray-500">
            Diese vier Schritte braucht der Verkaufsstand, bevor es losgehen kann.
          </p>
        </div>
        <span className="text-sm font-semibold text-primary shrink-0">
          {done}/{steps.length}
        </span>
      </div>

      {/* progress bar - a glance is enough to see how far along you are */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-500"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>

      <ol className="space-y-2">
        {steps.map((step, index) => {
          // the first unfinished step is the one we actively push
          const isNext = !step.done && steps.slice(0, index).every((s) => s.done)

          return (
            <li
              key={step.label}
              className={`flex items-center gap-3 rounded-lg p-2.5 ${isNext ? 'bg-primary-soft' : ''}`}
            >
              {step.done ? (
                <span className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </span>
              ) : (
                <CircleDashed className={`w-6 h-6 shrink-0 ${isNext ? 'text-primary' : 'text-gray-300'}`} />
              )}

              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${step.done ? 'text-gray-400 line-through' : ''}`}>
                  {step.label}
                </div>
                {!step.done && <div className="text-xs text-gray-500">{step.hint}</div>}
              </div>

              {/* only the next step gets a button, so there is exactly one obvious move */}
              {isNext && step.action && (
                <button
                  onClick={step.action}
                  className="shrink-0 bg-primary text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1"
                >
                  {step.cta} <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
