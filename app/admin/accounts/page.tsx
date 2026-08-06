import { AccountsInventoryPage } from "@/app/admin/accounts/accounts-inventory-page"

export default function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  return <AccountsInventoryPage accountModel="mother" searchParams={searchParams} />
}
