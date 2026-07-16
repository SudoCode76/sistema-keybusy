"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Country = {
  id: string
  iso2: string
  name: string
  dial_code: string
}

type CountrySelectProps = {
  countries: Country[]
  compact?: boolean
  defaultValue?: string
  name?: string
  onValueChange?: (value: string) => void
  required?: boolean
}

function countryText(country: Country, compact = false) {
  return compact
    ? `+${country.dial_code}`
    : `+${country.dial_code} ${country.name}`
}

function filterCountries(countries: Country[], search: string) {
  const query = search.trim().toLowerCase().replace(/^\+/, "")

  return query
    ? countries.filter((country) =>
        `${country.dial_code} ${country.name} ${country.iso2}`
          .toLowerCase()
          .includes(query)
      )
    : countries
}

export function CountrySelect({
  countries,
  compact = false,
  defaultValue,
  name = "country_id",
  onValueChange,
  required,
}: CountrySelectProps) {
  const defaultCountry =
    countries.find((country) => country.id === defaultValue) ?? countries[0]
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(
    defaultCountry ? countryText(defaultCountry, compact) : ""
  )
  const [value, setValue] = useState(defaultCountry?.id ?? "")
  const options = useMemo(
    () => filterCountries(countries, search),
    [countries, search]
  )

  function pickCountry(country: Country) {
    setValue(country.id)
    setSearch(countryText(country, compact))
    setOpen(false)
    onValueChange?.(country.id)
  }

  function searchCountry(nextSearch: string) {
    const nextOptions = filterCountries(countries, nextSearch)
    const nextValue = nextOptions.length === 1 ? nextOptions[0].id : ""

    setSearch(nextSearch)
    setValue(nextValue)
    setOpen(true)
    onValueChange?.(nextValue)
  }

  return (
    <div className="relative flex flex-col gap-2">
      <input name={name} value={value} type="hidden" />
      <Input
        aria-label="Buscar pais"
        autoComplete="off"
        name={`${name}_search`}
        placeholder="Escribe codigo o pais"
        required={required}
        value={search}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => searchCountry(event.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open ? (
        <div className="absolute top-full mt-2 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {options.length > 0 ? (
            options.map((country) => (
              <Button
                className="w-full justify-start"
                key={country.id}
                onMouseDown={(event) => {
                  event.preventDefault()
                  pickCountry(country)
                }}
                type="button"
                variant="ghost"
              >
                {countryText(country)}
              </Button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Sin resultados
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
