import { AccountsInventoryPage } from "@/app/admin/accounts/accounts-inventory-page"

export default function PersonalAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  return <AccountsInventoryPage accountModel="private" searchParams={searchParams} />
}
