import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { SectionHeader } from '../components/ui'

// "Rundgang" mode: a seller loops through the bus/dorm taking pre-orders. Distinct
// route from /preorders because it's a full-screen fast-input flow, not a queue view.
// Steps cycle: pick participant → pick product → confirm → repeat, keeping a running
// counter of how many orders were taken this session so the seller knows they're making
// progress. Explicit "Fertig" button exits back to the queue.
//
// Slice-A skeleton: shell + counter + navigation. The pick-participant and pick-product
// steps land in the next commit.
export default function PreOrderWalk() {
  const navigate = useNavigate()
  const [taken, setTaken] = useState([])   // list of just-placed orders this session

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/preorders')}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Fertig
        </button>
        <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" /> {taken.length} aufgenommen
        </span>
      </div>
      <SectionHeader title="Rundgang" hint="Bestellungen unterwegs aufnehmen" />

      {/* pick-participant + pick-product flow lands in the next commit */}
      <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400">
        Rundgang-Ablauf folgt…
      </div>
    </div>
  )
}
