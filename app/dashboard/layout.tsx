import SOSButton from '@/components/SOSButton'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <SOSButton />
    </>
  )
}
