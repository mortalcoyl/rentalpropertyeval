"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DEFAULTS = {
  purchasePrice: 750000,
  downPaymentPct: 25,
  mortgageRate: 6.75,
  mortgageYears: 30,
  closingCostPct: 2.5,
  monthlyRent: 4500,
  rentGrowth: 3,
  vacancyPct: 5,
  propertyAppreciation: 3.5,
  propertyTaxPct: 1.1,
  insuranceAnnual: 1800,
  maintenancePct: 1,
  managementPct: 8,
  capexMonthly: 250,
  otherMonthly: 150,
  expenseInflation: 3,
  sellingCostPct: 6,
  taxRate: 32,
  depreciationYears: 27.5,
  landValuePct: 20,
  horizonYears: 30,
  alternateInvestmentReturn: 7,
  cashFlowStrategy: "reinvest",
};

function Card({ children, className = "", style }) {
  return (
    <div style={style} className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function Button({ children, className = "", variant = "default", ...props }) {
  const variantClass =
    variant === "outline"
      ? "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
      : "bg-zinc-900 text-white hover:bg-zinc-700";

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
}

function ResetIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

function BreakEvenIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3v18" />
      <path d="M5 7h14" />
      <path d="M6 7l-3 6h6l-3-6z" />
      <path d="M18 7l-3 6h6l-3-6z" />
      <path d="M6 17h12" />
    </svg>
  );
}

function currency(value, compact = false) {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function chartCurrency(value) {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

function percent(value) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function multiple(value) {
  if (!Number.isFinite(value)) return "0.0x";
  return `${value.toFixed(2)}x`;
}

function monthlyPayment(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return principal / months;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
}

function annualLoanProgress(startBalance, annualRate, scheduledMonthlyPayment) {
  let balance = Math.max(0, startBalance);
  let interestPaid = 0;
  let paymentsMade = 0;
  const monthlyRate = annualRate / 100 / 12;

  for (let month = 0; month < 12; month += 1) {
    if (balance <= 0) break;
    const interest = balance * monthlyRate;
    const scheduledPrincipal = Math.max(0, scheduledMonthlyPayment - interest);
    const principalPayment = Math.min(balance, scheduledPrincipal);
    const payment = interest + principalPayment;
    interestPaid += interest;
    paymentsMade += payment;
    balance -= principalPayment;
  }

  return { endBalance: Math.max(0, balance), interestPaid, paymentsMade };
}

function calculateBreakEvenMonthlyRent(inputs) {
  const {
    purchasePrice,
    downPaymentPct,
    mortgageRate,
    mortgageYears,
    vacancyPct,
    propertyAppreciation,
    propertyTaxPct,
    insuranceAnnual,
    maintenancePct,
    managementPct,
    capexMonthly,
    otherMonthly,
  } = inputs;

  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loan = Math.max(0, purchasePrice - downPayment);
  const mortgage = monthlyPayment(loan, mortgageRate, mortgageYears);
  const firstYearPropertyValue = purchasePrice * (1 + propertyAppreciation / 100);
  const fixedMonthlyExpenses =
    (firstYearPropertyValue * (propertyTaxPct / 100)) / 12 +
    insuranceAnnual / 12 +
    (firstYearPropertyValue * (maintenancePct / 100)) / 12 +
    capexMonthly +
    otherMonthly;

  const vacancyFactor = Math.max(0, 1 - vacancyPct / 100);
  const managementFactor = Math.max(0, 1 - managementPct / 100);
  const denominator = vacancyFactor * managementFactor;
  if (denominator <= 0) return 0;
  return Math.max(0, Math.round((mortgage + fixedMonthlyExpenses) / denominator));
}

function buildRentalModel(inputs) {
  const {
    purchasePrice,
    downPaymentPct,
    mortgageRate,
    mortgageYears,
    closingCostPct,
    monthlyRent,
    rentGrowth,
    vacancyPct,
    propertyAppreciation,
    propertyTaxPct,
    insuranceAnnual,
    maintenancePct,
    managementPct,
    capexMonthly,
    otherMonthly,
    expenseInflation,
    sellingCostPct,
    taxRate,
    depreciationYears,
    landValuePct,
    horizonYears,
    alternateInvestmentReturn,
    cashFlowStrategy,
  } = inputs;

  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loan = Math.max(0, purchasePrice - downPayment);
  const closingCosts = purchasePrice * (closingCostPct / 100);
  const initialCash = downPayment + closingCosts;
  const mortgage = monthlyPayment(loan, mortgageRate, mortgageYears);
  const annualDebtService = mortgage * 12;
  const depreciableBasis = purchasePrice * (1 - landValuePct / 100);
  const annualDepreciation = depreciationYears > 0 ? depreciableBasis / depreciationYears : 0;

  const chart = [];
  let cumulativeCashFlow = 0;
  let reinvestedPositiveCashFlow = 0;
  let cumulativeNegativeCashFlow = 0;
  let payoffContribution = 0;
  let actualLoanBalance = loan;
  let payoffYear = loan <= 0 ? 0 : null;

  chart.push({
    year: 0,
    PropertyValue: Math.round(purchasePrice),
    EquityAfterSale: Math.round(Math.max(0, purchasePrice - loan - purchasePrice * (sellingCostPct / 100))),
    CumulativeCashFlow: 0,
    ReinvestedCashFlow: 0,
    PayoffContribution: 0,
    StrategyCashFlowValue: 0,
    InvestorValue: Math.round(-initialCash),
    DownPaymentInvestment: Math.round(downPayment),
    LoanBalance: Math.round(loan),
    LoanPaidOffMarker: null,
    NOI: 0,
    CashFlow: 0,
  });

  for (let year = 1; year <= horizonYears; year += 1) {
    const yearIndex = year - 1;
    const currentValue = purchasePrice * Math.pow(1 + propertyAppreciation / 100, year);
    const annualGrossRent = monthlyRent * 12 * Math.pow(1 + rentGrowth / 100, yearIndex);
    const vacancyLoss = annualGrossRent * (vacancyPct / 100);
    const effectiveRent = annualGrossRent - vacancyLoss;
    const management = effectiveRent * (managementPct / 100);
    const propertyTax = currentValue * (propertyTaxPct / 100);
    const maintenance = currentValue * (maintenancePct / 100);
    const insurance = insuranceAnnual * Math.pow(1 + expenseInflation / 100, yearIndex);
    const capex = capexMonthly * 12 * Math.pow(1 + expenseInflation / 100, yearIndex);
    const other = otherMonthly * 12 * Math.pow(1 + expenseInflation / 100, yearIndex);
    const operatingExpenses = management + propertyTax + maintenance + insurance + capex + other;
    const noi = effectiveRent - operatingExpenses;

    const loanProgress = annualLoanProgress(actualLoanBalance, mortgageRate, mortgage);
    actualLoanBalance = loanProgress.endBalance;
    if (payoffYear === null && actualLoanBalance <= 0) payoffYear = year;

    const taxableIncome = noi - loanProgress.interestPaid - annualDepreciation;
    const taxEffect = -taxableIncome * (taxRate / 100);
    const afterTaxCashFlow = noi - loanProgress.paymentsMade + taxEffect;

    cumulativeCashFlow += afterTaxCashFlow;
    reinvestedPositiveCashFlow *= 1 + alternateInvestmentReturn / 100;

    if (afterTaxCashFlow > 0) {
      if (cashFlowStrategy === "paydown") {
        const extraPrincipal = Math.min(afterTaxCashFlow, actualLoanBalance);
        actualLoanBalance -= extraPrincipal;
        payoffContribution += extraPrincipal;
        if (payoffYear === null && actualLoanBalance <= 0) payoffYear = year;
        const surplusAfterPayoff = afterTaxCashFlow - extraPrincipal;
        reinvestedPositiveCashFlow += surplusAfterPayoff;
      } else {
        reinvestedPositiveCashFlow += afterTaxCashFlow;
      }
    } else {
      cumulativeNegativeCashFlow += afterTaxCashFlow;
    }

    const loanBalance = actualLoanBalance;
    const sellingCost = currentValue * (sellingCostPct / 100);
    const equityAfterSale = currentValue - loanBalance - sellingCost;
    const strategyCashFlowValue = cashFlowStrategy === "paydown" ? payoffContribution : reinvestedPositiveCashFlow;
    const investorValue = equityAfterSale + reinvestedPositiveCashFlow + cumulativeNegativeCashFlow;
    const downPaymentInvestment = downPayment * Math.pow(1 + alternateInvestmentReturn / 100, year);
    const loanPaidOffMarker = payoffYear === year ? strategyCashFlowValue : null;

    chart.push({
      year,
      PropertyValue: Math.round(currentValue),
      EquityAfterSale: Math.round(equityAfterSale),
      CumulativeCashFlow: Math.round(cumulativeCashFlow),
      ReinvestedCashFlow: Math.round(reinvestedPositiveCashFlow),
      PayoffContribution: Math.round(payoffContribution),
      StrategyCashFlowValue: Math.round(strategyCashFlowValue),
      InvestorValue: Math.round(investorValue),
      DownPaymentInvestment: Math.round(downPaymentInvestment),
      LoanBalance: Math.round(loanBalance),
      LoanPaidOffMarker: loanPaidOffMarker === null ? null : Math.round(loanPaidOffMarker),
      NOI: Math.round(noi),
      CashFlow: Math.round(afterTaxCashFlow),
    });
  }

  const firstYear = chart[1] || chart[0];
  const final = chart[chart.length - 1];
  const firstYearGrossRent = monthlyRent * 12;
  const firstYearEffectiveRent = firstYearGrossRent * (1 - vacancyPct / 100);
  const firstYearVacancyLossMonthly = firstYearGrossRent * (vacancyPct / 100) / 12;
  const firstYearEffectiveRentMonthly = firstYearEffectiveRent / 12;
  const firstYearOperatingExpensesMonthly = Math.max(0, (firstYearEffectiveRent - firstYear.NOI) / 12);
  const firstYearPropertyTaxMonthly = (purchasePrice * (1 + propertyAppreciation / 100) * (propertyTaxPct / 100)) / 12;
  const firstYearInsuranceMonthly = insuranceAnnual / 12;
  const firstYearMaintenanceMonthly = (purchasePrice * (1 + propertyAppreciation / 100) * (maintenancePct / 100)) / 12;
  const firstYearManagementMonthly = (firstYearEffectiveRent * (managementPct / 100)) / 12;
  const firstYearCapexMonthly = capexMonthly;
  const firstYearOtherMonthly = otherMonthly;
  const firstYearMonthlyProfitLossBeforeTax = firstYear.NOI / 12 - mortgage;
  const firstYearBreakEvenMonthlyRent = calculateBreakEvenMonthlyRent({
    purchasePrice,
    downPaymentPct,
    mortgageRate,
    mortgageYears,
    vacancyPct,
    propertyAppreciation,
    propertyTaxPct,
    insuranceAnnual,
    maintenancePct,
    managementPct,
    capexMonthly,
    otherMonthly,
  });
  const firstYearCapRate = purchasePrice > 0 ? (firstYear.NOI / purchasePrice) * 100 : 0;
  const firstYearCashOnCash = initialCash > 0 ? ((firstYear.CashFlow || 0) / initialCash) * 100 : 0;
  const dscr = annualDebtService > 0 ? firstYear.NOI / annualDebtService : 0;
  const totalProfit = final.InvestorValue - initialCash;
  const equityMultiple = initialCash > 0 ? final.InvestorValue / initialCash : 0;
  const annualizedReturn = initialCash > 0 && final.InvestorValue > 0 ? (Math.pow(final.InvestorValue / initialCash, 1 / Math.max(1, horizonYears)) - 1) * 100 : 0;
  const alternateInvestmentGain = final.DownPaymentInvestment - downPayment;
  const rentalVsInvestmentDifference = final.InvestorValue - final.DownPaymentInvestment;
  const strategyLabel = cashFlowStrategy === "paydown" ? "Pay off contribution" : "Reinvested surplus cash flow";

  return {
    chart,
    final,
    downPayment,
    loan,
    closingCosts,
    initialCash,
    mortgage,
    annualDebtService,
    firstYearGrossRent,
    firstYearEffectiveRent,
    firstYearVacancyLossMonthly,
    firstYearEffectiveRentMonthly,
    firstYearOperatingExpensesMonthly,
    firstYearPropertyTaxMonthly,
    firstYearInsuranceMonthly,
    firstYearMaintenanceMonthly,
    firstYearManagementMonthly,
    firstYearCapexMonthly,
    firstYearOtherMonthly,
    firstYearMonthlyProfitLossBeforeTax,
    firstYearBreakEvenMonthlyRent,
    firstYearCapRate,
    firstYearCashOnCash,
    dscr,
    totalProfit,
    equityMultiple,
    annualizedReturn,
    alternateInvestmentGain,
    rentalVsInvestmentDifference,
    strategyLabel,
    payoffYear,
  };
}

function buildScenarioAnalysis(inputs) {
  const scenarioDefinitions = [
    {
      name: "Base case",
      description: "Uses the current assumptions from the calculator.",
      inputs,
      adjustments: [{ assumption: "All assumptions", change: "No changes" }],
    },
    {
      name: "Conservative case",
      description: "Lower rent/appreciation, higher vacancy, and higher expenses.",
      adjustments: [
        { assumption: "Rent growth", change: "-1.5pp" },
        { assumption: "Property appreciation", change: "-2pp" },
        { assumption: "Vacancy", change: "+5pp" },
        { assumption: "Maintenance", change: "+0.5pp" },
        { assumption: "Capex reserve", change: "+$150/mo" },
        { assumption: "Expense inflation", change: "+1pp" },
        { assumption: "Selling cost", change: "+1pp" },
        { assumption: "Alt return", change: "-1pp" },
      ],
      inputs: {
        ...inputs,
        rentGrowth: Math.max(0, inputs.rentGrowth - 1.5),
        propertyAppreciation: inputs.propertyAppreciation - 2,
        vacancyPct: Math.min(30, inputs.vacancyPct + 5),
        maintenancePct: Math.min(6, inputs.maintenancePct + 0.5),
        capexMonthly: inputs.capexMonthly + 150,
        expenseInflation: inputs.expenseInflation + 1,
        sellingCostPct: Math.min(12, inputs.sellingCostPct + 1),
        alternateInvestmentReturn: Math.max(0, inputs.alternateInvestmentReturn - 1),
      },
    },
    {
      name: "Aggressive case",
      description: "Higher rent/appreciation, lower vacancy, and lower expense pressure.",
      adjustments: [
        { assumption: "Rent growth", change: "+1.5pp" },
        { assumption: "Property appreciation", change: "+2pp" },
        { assumption: "Vacancy", change: "-3pp" },
        { assumption: "Maintenance", change: "-0.25pp" },
        { assumption: "Capex reserve", change: "-$100/mo" },
        { assumption: "Expense inflation", change: "-0.75pp" },
        { assumption: "Selling cost", change: "-0.5pp" },
        { assumption: "Alt return", change: "+1pp" },
      ],
      inputs: {
        ...inputs,
        rentGrowth: inputs.rentGrowth + 1.5,
        propertyAppreciation: inputs.propertyAppreciation + 2,
        vacancyPct: Math.max(0, inputs.vacancyPct - 3),
        maintenancePct: Math.max(0, inputs.maintenancePct - 0.25),
        capexMonthly: Math.max(0, inputs.capexMonthly - 100),
        expenseInflation: Math.max(0, inputs.expenseInflation - 0.75),
        sellingCostPct: Math.max(0, inputs.sellingCostPct - 0.5),
        alternateInvestmentReturn: inputs.alternateInvestmentReturn + 1,
      },
    },
  ];

  const scenarios = scenarioDefinitions.map((scenario) => {
    const model = buildRentalModel(scenario.inputs);
    return {
      ...scenario,
      rentalProfit: model.totalProfit,
      altProfit: model.alternateInvestmentGain,
      decisionSpread: model.totalProfit - model.alternateInvestmentGain,
      winner: model.totalProfit >= model.alternateInvestmentGain ? "Rental property" : "Alt investment",
      annualizedReturn: model.annualizedReturn,
    };
  });

  const baseSpread = scenarios[0].decisionSpread;
  const sensitivityInputs = [
    { label: "Property appreciation", key: "propertyAppreciation", delta: 1, suffix: "pp" },
    { label: "Rent growth", key: "rentGrowth", delta: 1, suffix: "pp" },
    { label: "Vacancy", key: "vacancyPct", delta: 2, suffix: "pp" },
    { label: "Mortgage rate", key: "mortgageRate", delta: 0.5, suffix: "pp" },
    { label: "Alt investment return", key: "alternateInvestmentReturn", delta: 1, suffix: "pp" },
    { label: "Maintenance", key: "maintenancePct", delta: 0.5, suffix: "pp" },
    { label: "Capex reserve", key: "capexMonthly", delta: 100, suffix: "/mo" },
  ];

  const sensitivities = sensitivityInputs
    .map((item) => {
      const adjustedInputs = { ...inputs, [item.key]: Math.max(0, inputs[item.key] + item.delta) };
      const adjustedModel = buildRentalModel(adjustedInputs);
      const adjustedSpread = adjustedModel.totalProfit - adjustedModel.alternateInvestmentGain;
      return { ...item, impact: adjustedSpread - baseSpread, adjustedSpread };
    })
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return { scenarios, sensitivities };
}

function Slider({ label, value, setValue, min, max, step, suffix = "", prefix = "", helper }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-zinc-900">{label}</div>
          {helper ? <div className="text-xs text-zinc-500">{helper}</div> : null}
        </div>
        <div className="text-sm font-semibold tabular-nums text-zinc-900">
          {prefix}
          {typeof value === "number" ? value.toLocaleString() : value}
          {suffix}
        </div>
      </div>
      <input
        className="w-full accent-zinc-900"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => setValue(Number(event.target.value))}
      />
    </div>
  );
}

function StatRow({ label, value, strong = false }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className={`${strong ? "font-semibold text-zinc-900" : "font-medium"} tabular-nums`}>{value}</span>
    </div>
  );
}

function CollapsibleSection({ title, description, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-zinc-900">{title}</div>
          {description ? <div className="text-xs text-zinc-500">{description}</div> : null}
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open ? <div className="mt-4 space-y-5">{children}</div> : null}
    </div>
  );
}

function LoanPaidOffDot(props) {
  const { cx, cy } = props;
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  return (
    <path
      d={`M ${cx} ${cy - 6} L ${cx + 6} ${cy} L ${cx} ${cy + 6} L ${cx - 6} ${cy} Z`}
      fill="#18181b"
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}

function StrategyToggle({ value, setValue }) {
  const options = [
    { value: "reinvest", label: "Reinvest cash flow" },
    { value: "paydown", label: "Pay off contribution" },
  ];
  return (
    <div className="rounded-2xl bg-zinc-100 p-1">
      <div className="grid grid-cols-2 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setValue(option.value)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${value === option.value ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:bg-white/60 hover:text-zinc-950"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-600">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="inline-block h-0 w-8 border-t-[3px]" style={{ borderColor: item.color, borderStyle: item.dashed ? "dashed" : "solid" }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function AdvancedDecisionAnalysis({ inputs }) {
  const analysis = useMemo(() => buildScenarioAnalysis(inputs), [inputs]);
  return (
    <CollapsibleSection title="Advanced decision analysis" description="Compare base, conservative, and aggressive cases without changing the main chart." defaultOpen={false}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {analysis.scenarios.map((scenario) => (
          <div key={scenario.name} className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-zinc-200">
            <div className="font-medium text-zinc-900">{scenario.name}</div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{scenario.description}</p>
            <div className="mt-4 space-y-2 text-zinc-700">
              <StatRow label="Winner" value={scenario.winner} strong />
              <StatRow label="Rental profit" value={currency(scenario.rentalProfit)} />
              <StatRow label="Alt profit" value={currency(scenario.altProfit)} />
              <StatRow label="Rental vs. alt" value={currency(scenario.decisionSpread)} strong />
              <StatRow label="Rental annualized" value={percent(scenario.annualizedReturn)} />
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Assumption</th>
                    <th className="px-3 py-2 text-right font-medium">Adjustment</th>
                  </tr>
                </thead>
                <tbody>
                  {scenario.adjustments.map((adjustment) => (
                    <tr key={`${scenario.name}-${adjustment.assumption}`} className="border-t border-zinc-100">
                      <td className="px-3 py-2 text-zinc-700">{adjustment.assumption}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-zinc-900">{adjustment.change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-zinc-200">
        <div className="font-medium text-zinc-900">Which assumption drives the decision most?</div>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Shows how much the rental-vs-alt-investment spread changes when each assumption is increased by the listed amount.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-4 font-medium">Assumption</th>
                <th className="py-2 pr-4 font-medium">Test change</th>
                <th className="py-2 pr-4 text-right font-medium">Impact on decision</th>
                <th className="py-2 text-right font-medium">New rental vs. alt</th>
              </tr>
            </thead>
            <tbody>
              {analysis.sensitivities.map((item) => (
                <tr key={item.label} className="border-b border-zinc-100 last:border-0">
                  <td className="py-2 pr-4 text-zinc-900">{item.label}</td>
                  <td className="py-2 pr-4 text-zinc-600">+{item.delta}{item.suffix}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-900">{currency(item.impact)}</td>
                  <td className="py-2 text-right tabular-nums text-zinc-900">{currency(item.adjustedSpread)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function MainChart({ model, cashFlowStrategy }) {
  const [showSecondaryLines, setShowSecondaryLines] = useState(false);
  const legendItems = [
    { label: "Rental Investment Value", color: "#2563eb" },
    { label: "Alt Investment Value", color: "#16a34a" },
    { label: "Property Value", color: "#a855f7", dashed: true },
    ...(showSecondaryLines ? [{ label: "Equity after sale", color: "#a1a1aa" }, { label: model.strategyLabel, color: "#ea580c" }] : []),
  ];

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-5">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Estimated rental property value over time</h2>
          <p className="text-sm text-zinc-500">Tracks investor value, property value, equity after sale, the selected cash-flow strategy, and a down-payment investment alternative.</p>
        </div>
        <div className="mt-2 h-[520px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.chart} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tickFormatter={(value) => `${value}y`} />
              <YAxis tickFormatter={(value) => chartCurrency(value)} width={70} />
              <Tooltip formatter={(value) => currency(Number(value))} labelFormatter={(label) => `Year ${label}`} />
              {cashFlowStrategy === "paydown" && model.payoffYear !== null ? <ReferenceLine x={model.payoffYear} stroke="#18181b" strokeDasharray="2 4" ifOverflow="extendDomain" /> : null}
              <Line type="monotone" dataKey="InvestorValue" name="Rental Investment Value" stroke="#2563eb" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="DownPaymentInvestment" name="Alt Investment Value" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="PropertyValue" name="Property Value" stroke="#a855f7" strokeWidth={2} strokeDasharray="2 4" dot={false} />
              {showSecondaryLines ? <Line type="monotone" dataKey="EquityAfterSale" name="Equity after sale" stroke="#a1a1aa" strokeWidth={2} dot={false} /> : null}
              {showSecondaryLines ? <Line type="monotone" dataKey="StrategyCashFlowValue" name={model.strategyLabel} stroke="#ea580c" strokeWidth={2} dot={false} /> : null}
              {cashFlowStrategy === "paydown" ? (
                <Line type="monotone" dataKey="LoanPaidOffMarker" name="Loan paid off" stroke="transparent" strokeWidth={0} dot={<LoanPaidOffDot />} activeDot={<LoanPaidOffDot />} legendType="none" connectNulls={false} />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-col items-center gap-3">
          <ChartLegend items={legendItems} />
          <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs font-medium text-zinc-700 shadow-sm" onClick={() => setShowSecondaryLines(!showSecondaryLines)}>
            {showSecondaryLines ? "Hide chart details" : "Show equity + cash flow details"}
          </Button>
        </div>
        {cashFlowStrategy === "paydown" ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600">
            <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rotate-45 bg-zinc-900" /><span>Loan paid off on pay off contribution line</span></div>
            <div className="flex items-center gap-2"><span className="inline-block h-5 border-l border-dotted border-zinc-900" /><span>Payoff year</span></div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function RentalPropertyCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(DEFAULTS.purchasePrice);
  const [downPaymentPct, setDownPaymentPct] = useState(DEFAULTS.downPaymentPct);
  const [mortgageRate, setMortgageRate] = useState(DEFAULTS.mortgageRate);
  const [mortgageYears, setMortgageYears] = useState(DEFAULTS.mortgageYears);
  const [closingCostPct, setClosingCostPct] = useState(DEFAULTS.closingCostPct);
  const [monthlyRent, setMonthlyRent] = useState(DEFAULTS.monthlyRent);
  const [rentGrowth, setRentGrowth] = useState(DEFAULTS.rentGrowth);
  const [vacancyPct, setVacancyPct] = useState(DEFAULTS.vacancyPct);
  const [propertyAppreciation, setPropertyAppreciation] = useState(DEFAULTS.propertyAppreciation);
  const [propertyTaxPct, setPropertyTaxPct] = useState(DEFAULTS.propertyTaxPct);
  const [insuranceAnnual, setInsuranceAnnual] = useState(DEFAULTS.insuranceAnnual);
  const [maintenancePct, setMaintenancePct] = useState(DEFAULTS.maintenancePct);
  const [managementPct, setManagementPct] = useState(DEFAULTS.managementPct);
  const [capexMonthly, setCapexMonthly] = useState(DEFAULTS.capexMonthly);
  const [otherMonthly, setOtherMonthly] = useState(DEFAULTS.otherMonthly);
  const [expenseInflation, setExpenseInflation] = useState(DEFAULTS.expenseInflation);
  const [sellingCostPct, setSellingCostPct] = useState(DEFAULTS.sellingCostPct);
  const [taxRate, setTaxRate] = useState(DEFAULTS.taxRate);
  const [depreciationYears, setDepreciationYears] = useState(DEFAULTS.depreciationYears);
  const [landValuePct, setLandValuePct] = useState(DEFAULTS.landValuePct);
  const [horizonYears, setHorizonYears] = useState(DEFAULTS.horizonYears);
  const [alternateInvestmentReturn, setAlternateInvestmentReturn] = useState(DEFAULTS.alternateInvestmentReturn);
  const [cashFlowStrategy, setCashFlowStrategy] = useState(DEFAULTS.cashFlowStrategy);

  const inputs = {
    purchasePrice,
    downPaymentPct,
    mortgageRate,
    mortgageYears,
    closingCostPct,
    monthlyRent,
    rentGrowth,
    vacancyPct,
    propertyAppreciation,
    propertyTaxPct,
    insuranceAnnual,
    maintenancePct,
    managementPct,
    capexMonthly,
    otherMonthly,
    expenseInflation,
    sellingCostPct,
    taxRate,
    depreciationYears,
    landValuePct,
    horizonYears,
    alternateInvestmentReturn,
    cashFlowStrategy,
  };

  const model = useMemo(() => buildRentalModel(inputs), [
    purchasePrice,
    downPaymentPct,
    mortgageRate,
    mortgageYears,
    closingCostPct,
    monthlyRent,
    rentGrowth,
    vacancyPct,
    propertyAppreciation,
    propertyTaxPct,
    insuranceAnnual,
    maintenancePct,
    managementPct,
    capexMonthly,
    otherMonthly,
    expenseInflation,
    sellingCostPct,
    taxRate,
    depreciationYears,
    landValuePct,
    horizonYears,
    alternateInvestmentReturn,
    cashFlowStrategy,
  ]);

  const scenarioInputs = useMemo(() => inputs, [
    purchasePrice,
    downPaymentPct,
    mortgageRate,
    mortgageYears,
    closingCostPct,
    monthlyRent,
    rentGrowth,
    vacancyPct,
    propertyAppreciation,
    propertyTaxPct,
    insuranceAnnual,
    maintenancePct,
    managementPct,
    capexMonthly,
    otherMonthly,
    expenseInflation,
    sellingCostPct,
    taxRate,
    depreciationYears,
    landValuePct,
    horizonYears,
    alternateInvestmentReturn,
    cashFlowStrategy,
  ]);

  const resetAssumptions = () => {
    setPurchasePrice(DEFAULTS.purchasePrice);
    setDownPaymentPct(DEFAULTS.downPaymentPct);
    setMortgageRate(DEFAULTS.mortgageRate);
    setMortgageYears(DEFAULTS.mortgageYears);
    setClosingCostPct(DEFAULTS.closingCostPct);
    setMonthlyRent(DEFAULTS.monthlyRent);
    setRentGrowth(DEFAULTS.rentGrowth);
    setVacancyPct(DEFAULTS.vacancyPct);
    setPropertyAppreciation(DEFAULTS.propertyAppreciation);
    setPropertyTaxPct(DEFAULTS.propertyTaxPct);
    setInsuranceAnnual(DEFAULTS.insuranceAnnual);
    setMaintenancePct(DEFAULTS.maintenancePct);
    setManagementPct(DEFAULTS.managementPct);
    setCapexMonthly(DEFAULTS.capexMonthly);
    setOtherMonthly(DEFAULTS.otherMonthly);
    setExpenseInflation(DEFAULTS.expenseInflation);
    setSellingCostPct(DEFAULTS.sellingCostPct);
    setTaxRate(DEFAULTS.taxRate);
    setDepreciationYears(DEFAULTS.depreciationYears);
    setLandValuePct(DEFAULTS.landValuePct);
    setHorizonYears(DEFAULTS.horizonYears);
    setAlternateInvestmentReturn(DEFAULTS.alternateInvestmentReturn);
    setCashFlowStrategy(DEFAULTS.cashFlowStrategy);
  };

  const makeRentalBreakEven = () => {
    const breakEvenRent = calculateBreakEvenMonthlyRent({
      purchasePrice,
      downPaymentPct,
      mortgageRate,
      mortgageYears,
      vacancyPct,
      propertyAppreciation,
      propertyTaxPct,
      insuranceAnnual,
      maintenancePct,
      managementPct,
      capexMonthly,
      otherMonthly,
    });
    setMonthlyRent(breakEvenRent);
  };

  const payoffText = model.payoffYear === null ? "After horizon" : `Year ${model.payoffYear}`;
  const rentalProfitWins = model.totalProfit > model.alternateInvestmentGain;
  const altInvestmentWins = model.alternateInvestmentGain > model.totalProfit;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rental Property Model</div>
            <h1 className="mt-2 text-[3rem] font-[600] leading-none tracking-tight">Rental Property Outcome Calculator</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Compare rental property purchase vs. market investment. Estimate how purchase price, financing, rents, expenses, appreciation, taxes, and sale assumptions affect long-term investor value.</p>
          </div>
          <Button type="button" variant="outline" className="h-9 rounded-xl border-zinc-300 px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50" onClick={resetAssumptions}>
            <ResetIcon className="mr-1.5 h-3.5 w-3.5" /> Reset assumptions
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card style={rentalProfitWins ? { borderColor: "#2563eb", borderWidth: 3 } : undefined}>
            <CardContent className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rental Property Profit</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{currency(model.totalProfit, true)}</div>
              <div className="mt-1 text-xs text-zinc-600">After initial cash invested · {percent(model.annualizedReturn)} annualized</div>
            </CardContent>
          </Card>
          <Card style={altInvestmentWins ? { borderColor: "#16a34a", borderWidth: 3 } : undefined}>
            <CardContent className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Alt investment total profit</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{currency(model.alternateInvestmentGain, true)}</div>
              <div className="mt-1 text-xs text-zinc-600">Invested with average return of {percent(alternateInvestmentReturn)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardContent className="space-y-5 p-5">
              <h2 className="text-xl font-semibold">Main assumptions</h2>
              <Slider label="Purchase price" value={purchasePrice} setValue={setPurchasePrice} min={100000} max={3000000} step={10000} prefix="$" />
              <Slider label="Down payment" value={downPaymentPct} setValue={setDownPaymentPct} min={0} max={60} step={1} suffix="%" helper={`${currency(model.downPayment)} cash into property`} />
              <Slider label="Mortgage rate" value={mortgageRate} setValue={setMortgageRate} min={2} max={12} step={0.05} suffix="%" />
              <Slider label="Monthly rent" value={monthlyRent} setValue={setMonthlyRent} min={0} max={30000} step={100} prefix="$" helper={`Mortgage + all expenses = ${currency(model.firstYearBreakEvenMonthlyRent)}`} />
              <Slider label="Time horizon" value={horizonYears} setValue={setHorizonYears} min={1} max={40} step={1} suffix=" years" />
              <Slider label="Alt. investment yearly return" value={alternateInvestmentReturn} setValue={setAlternateInvestmentReturn} min={0} max={15} step={0.25} suffix="%" helper="Used for the down-payment alternative and reinvested rental surplus." />
              <Button type="button" variant="outline" className="h-auto w-full items-start justify-start gap-3 rounded-xl px-3 py-3 text-left text-zinc-700 shadow-sm hover:shadow-md" onClick={makeRentalBreakEven}>
                <BreakEvenIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-700" />
                <span className="flex flex-col items-start"><span className="font-medium text-zinc-900">Make rental break even</span><span className="mt-1 text-xs font-normal leading-5 text-zinc-500">Adjust the rent to make the rental break even after vacancy allowance, rent, mortgage and expenses.</span></span>
              </Button>
              <div className="space-y-2">
                <div><div className="text-sm font-medium text-zinc-900">Cash-flow strategy</div><div className="text-xs text-zinc-500">Choose how positive annual rental surplus is used.</div></div>
                <StrategyToggle value={cashFlowStrategy} setValue={setCashFlowStrategy} />
              </div>
            </CardContent>
          </Card>
          <div className="lg:col-span-2"><MainChart model={model} cashFlowStrategy={cashFlowStrategy} /></div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardContent className="space-y-5 p-5"><h2 className="text-xl font-semibold">Growth rates</h2><Slider label="Property appreciation" value={propertyAppreciation} setValue={setPropertyAppreciation} min={-3} max={12} step={0.25} suffix="%" /><Slider label="Rent growth" value={rentGrowth} setValue={setRentGrowth} min={0} max={10} step={0.25} suffix="%" /><Slider label="Expense inflation" value={expenseInflation} setValue={setExpenseInflation} min={0} max={10} step={0.25} suffix="%" /><Slider label="Vacancy" value={vacancyPct} setValue={setVacancyPct} min={0} max={25} step={0.5} suffix="%" /></CardContent></Card>
          <Card><CardContent className="space-y-5 p-5"><h2 className="text-xl font-semibold">Rental expenses</h2><Slider label="Property tax" value={propertyTaxPct} setValue={setPropertyTaxPct} min={0} max={3} step={0.05} suffix="%" helper="Annual % of property value." /><Slider label="Management" value={managementPct} setValue={setManagementPct} min={0} max={15} step={0.5} suffix="%" helper="% of effective rent." /><Slider label="Maintenance" value={maintenancePct} setValue={setMaintenancePct} min={0} max={4} step={0.05} suffix="%" helper="Annual % of property value." /><CollapsibleSection title="More expense inputs" description="Insurance, capex reserve, and other monthly expenses." defaultOpen={false}><Slider label="Insurance" value={insuranceAnnual} setValue={setInsuranceAnnual} min={0} max={12000} step={100} prefix="$" suffix="/yr" /><Slider label="Capex reserve" value={capexMonthly} setValue={setCapexMonthly} min={0} max={3000} step={25} prefix="$" suffix="/mo" helper="Money set aside each month for large, unexpected repairs or replacements." /><Slider label="Other expenses" value={otherMonthly} setValue={setOtherMonthly} min={0} max={3000} step={25} prefix="$" suffix="/mo" /></CollapsibleSection></CardContent></Card>
          <Card><CardContent className="space-y-5 p-5"><h2 className="text-xl font-semibold">Tax + sale assumptions</h2><Slider label="Selling cost" value={sellingCostPct} setValue={setSellingCostPct} min={0} max={10} step={0.25} suffix="%" helper="Applied to future property value." /><CollapsibleSection title="Advanced tax assumptions" description="Simplified rental tax effect and depreciation assumptions." defaultOpen={false}><Slider label="Tax rate" value={taxRate} setValue={setTaxRate} min={0} max={50} step={1} suffix="%" /><Slider label="Land value" value={landValuePct} setValue={setLandValuePct} min={0} max={60} step={1} suffix="%" helper="Land is excluded from depreciation." /><Slider label="Depreciation period" value={depreciationYears} setValue={setDepreciationYears} min={15} max={39} step={0.5} suffix=" years" /></CollapsibleSection><CollapsibleSection title="Loan + closing cost assumptions" description="Mortgage term and upfront transaction cost." defaultOpen={false}><Slider label="Loan term" value={mortgageYears} setValue={setMortgageYears} min={10} max={40} step={1} suffix=" years" /><Slider label="Closing costs" value={closingCostPct} setValue={setClosingCostPct} min={0} max={8} step={0.25} suffix="%" /></CollapsibleSection></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardContent className="p-5 text-sm text-zinc-700"><h2 className="text-xl font-semibold text-zinc-900">Today's financing math</h2><div className="mt-4 grid grid-cols-2 gap-2"><div>Loan amount</div><div className="text-right tabular-nums">{currency(model.loan)}</div><div>Monthly payment</div><div className="text-right tabular-nums">{currency(model.mortgage)}</div><div>Closing costs</div><div className="text-right tabular-nums">{currency(model.closingCosts)}</div><div>Loan paid off</div><div className="text-right tabular-nums">{payoffText}</div><div className="font-semibold">Initial cash</div><div className="text-right font-semibold tabular-nums">{currency(model.initialCash)}</div></div><div className="mt-4 border-t border-zinc-200 pt-3"><div className="mb-2 font-medium text-zinc-900">Monthly profit / loss</div><div className="grid grid-cols-2 gap-2"><div>Rent revenue</div><div className="text-right tabular-nums">{currency(monthlyRent)}</div><div>Vacancy allowance</div><div className="text-right tabular-nums">-{currency(model.firstYearVacancyLossMonthly)}</div><div>Effective rent</div><div className="text-right tabular-nums">{currency(model.firstYearEffectiveRentMonthly)}</div><div>Operating expenses</div><div className="text-right tabular-nums">-{currency(model.firstYearOperatingExpensesMonthly)}</div><div className="pl-3 text-zinc-500">Property tax</div><div className="text-right tabular-nums text-zinc-500">-{currency(model.firstYearPropertyTaxMonthly)}</div><div className="pl-3 text-zinc-500">Insurance</div><div className="text-right tabular-nums text-zinc-500">-{currency(model.firstYearInsuranceMonthly)}</div><div className="pl-3 text-zinc-500">Maintenance</div><div className="text-right tabular-nums text-zinc-500">-{currency(model.firstYearMaintenanceMonthly)}</div><div className="pl-3 text-zinc-500">Management</div><div className="text-right tabular-nums text-zinc-500">-{currency(model.firstYearManagementMonthly)}</div><div className="pl-3 text-zinc-500">Capex reserve</div><div className="text-right tabular-nums text-zinc-500">-{currency(model.firstYearCapexMonthly)}</div><div className="pl-3 text-zinc-500">Other expenses</div><div className="text-right tabular-nums text-zinc-500">-{currency(model.firstYearOtherMonthly)}</div><div>Mortgage payment</div><div className="text-right tabular-nums">-{currency(model.mortgage)}</div><div className="font-semibold">Net monthly P/L</div><div className="text-right font-semibold tabular-nums">{currency(model.firstYearMonthlyProfitLossBeforeTax)}</div></div></div></CardContent></Card>
          <Card><CardContent className="p-5"><h2 className="text-xl font-semibold">Final-year breakdown</h2><div className="mt-4 space-y-4"><div className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700"><div className="font-medium text-zinc-900">Sale value at year {horizonYears}</div><div className="mt-2 space-y-2"><StatRow label="Property Value" value={currency(model.final.PropertyValue)} /><StatRow label="Remaining loan" value={currency(model.final.LoanBalance)} /><StatRow label="Loan paid off" value={payoffText} /><StatRow label="Selling costs" value={currency(model.final.PropertyValue * (sellingCostPct / 100))} /><StatRow label="Equity after sale" value={currency(model.final.EquityAfterSale)} strong /></div></div><div className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700"><div className="font-medium text-zinc-900">Investor outcome</div><div className="mt-2 space-y-2"><StatRow label="Initial cash invested" value={currency(model.initialCash)} /><StatRow label="Cumulative cash flow" value={currency(model.final.CumulativeCashFlow)} /><StatRow label={model.strategyLabel} value={currency(model.final.StrategyCashFlowValue)} /><StatRow label="Investor value" value={currency(model.final.InvestorValue)} /><StatRow label="Equity multiple" value={multiple(model.equityMultiple)} /><StatRow label="Down payment invested" value={currency(model.final.DownPaymentInvestment)} /><StatRow label="Rental vs. investment" value={currency(model.rentalVsInvestmentDifference)} strong /></div></div></div></CardContent></Card>
          <Card><CardContent className="p-5"><h2 className="text-xl font-semibold">Cash flow over time</h2><div className="mt-4 h-[260px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={model.chart} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" tickFormatter={(value) => `${value}y`} /><YAxis tickFormatter={(value) => chartCurrency(value)} width={70} /><Tooltip formatter={(value) => currency(Number(value))} labelFormatter={(label) => `Year ${label}`} /><Area type="monotone" dataKey="CumulativeCashFlow" name="Cumulative cash flow" stroke="#52525b" fill="#e4e4e7" strokeWidth={2} /></AreaChart></ResponsiveContainer></div><div className="mt-4 space-y-2 text-sm text-zinc-700"><StatRow label="First-year gross rent" value={currency(model.firstYearGrossRent)} /><StatRow label="First-year effective rent" value={currency(model.firstYearEffectiveRent)} /><StatRow label="First-year NOI" value={currency(model.chart[1]?.NOI || 0)} /><StatRow label="Cap rate" value={percent(model.firstYearCapRate)} /><StatRow label="Cash-on-cash" value={percent(model.firstYearCashOnCash)} /><StatRow label="DSCR" value={multiple(model.dscr)} strong /></div></CardContent></Card>
        </div>

        <AdvancedDecisionAnalysis inputs={scenarioInputs} />
        <CollapsibleSection title="Model notes" description="Show assumptions and limitations of the simplified model." defaultOpen={false}>
          <p className="text-sm leading-6 text-zinc-700">This is a simplified rental property model. It assumes annual rent and expense step-ups, fixed-rate amortizing debt, a sale at the selected horizon, and a simplified tax effect from taxable rental income or losses. In reinvest mode, positive annual after-tax rental cash flow is invested at the alternate yearly return and added to investor value. In pay-off mode, positive annual surplus is used as an extra principal contribution, reducing the remaining loan balance and increasing equity after sale. Negative annual cash flow still reduces investor value. It does not model refinance proceeds, transaction timing, passive loss limits, depreciation recapture, capital gains tax, or local tax details.</p>
        </CollapsibleSection>
      </div>
    </div>
  );
}
