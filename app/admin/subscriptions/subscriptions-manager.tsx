"use client"

import { useState } from "react"

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { SaleDialog } from "./sale-dialog"
import type {
  AccountOption,
  CountryOption,
  ProductOption,
  ProviderOption,
  ReleasedSpotifyAccessOption,
} from "./sale-form"
import { SubscriptionsTable, type SubscriptionRow } from "./subscriptions-table"

export function SubscriptionsManager({
  accounts,
  releasedSpotifyAccesses,
  countries,
  defaultCountryId,
  initialActiveTotal,
  initialSalesBob,
  initialSalesUsdt,
  initialRows,
  initialTotal,
  platforms,
  products,
  providers,
  assignment,
  binanceRate,
}: {
  accounts: AccountOption[]
  releasedSpotifyAccesses: ReleasedSpotifyAccessOption[]
  countries: CountryOption[]
  defaultCountryId?: string
  initialActiveTotal: number
  initialSalesBob: number
  initialSalesUsdt: number
  initialRows: SubscriptionRow[]
  initialTotal: number
  platforms: { slug: string; name: string }[]
  products: ProductOption[]
  providers: ProviderOption[]
  assignment?: {
    accountId: string
    productSlug: string
    reusableAccessId?: string
  }
  binanceRate: number | null
}) {
  const [platform, setPlatform] = useState("all")
  const defaultProductSlug =
    platform === "all"
      ? products[0]?.slug
      : (products.find(
          (product) => product.serviceSlug === platform && product.isDefault
        ) ?? products.find((product) => product.serviceSlug === platform))?.slug

  return (
    <>
      <CardHeader className="min-w-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Accesos</CardTitle>
          <CardDescription>
            Activos, vencidos y pendientes de renovar.
          </CardDescription>
        </div>
        <SaleDialog
          accounts={accounts}
          countries={countries}
          defaultCountryId={defaultCountryId}
          defaultOpen={Boolean(assignment)}
          defaultProductSlug={assignment?.productSlug ?? defaultProductSlug}
          defaultReusableAccessId={assignment?.reusableAccessId}
          defaultServiceAccountId={assignment?.accountId}
          key={`${platform}:${assignment?.productSlug ?? defaultProductSlug ?? ""}:${assignment?.accountId ?? ""}:${assignment?.reusableAccessId ?? ""}`}
          products={products}
          providers={providers}
          releasedSpotifyAccesses={releasedSpotifyAccesses}
        />
      </CardHeader>
      <CardContent className="min-w-0">
        <SubscriptionsTable
          accounts={accounts}
          countries={countries}
          defaultCountryId={defaultCountryId}
          initialActiveTotal={initialActiveTotal}
          initialSalesBob={initialSalesBob}
          initialSalesUsdt={initialSalesUsdt}
          initialRows={initialRows}
          initialTotal={initialTotal}
          onPlatformChange={setPlatform}
          platform={platform}
          platforms={platforms}
          products={products}
          providers={providers}
          binanceRate={binanceRate}
        />
      </CardContent>
    </>
  )
}
