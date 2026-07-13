import { getActionBySlug } from "@/lib/action-registry"
import DynamicActionClient from "./DynamicActionClient"

interface DynamicActionPageProps {
  params: Promise<{ target: string }>
}

export default async function DynamicActionPage({ params }: DynamicActionPageProps) {
  const { target } = await params
  const action = getActionBySlug(target)

  if (!action) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Action not found</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          The action &quot;{target}&quot; does not exist.
        </p>
      </div>
    )
  }

  return <DynamicActionClient action={action} />
}
