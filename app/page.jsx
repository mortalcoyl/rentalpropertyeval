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
  includeCoveredLossesInAlt: true,
};

const MARKET_RETURN_PRESETS = [
  { label: "DOW", value: 9.3, description: "30-year total return est." },
  { label: "S&P 500", value: 10.4, description: "30-year total return" },
  { label: "Nasdaq", value: 11.2, description: "30-year total return est." },
];

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
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

function BreakEvenIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
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

  return {
    endBalance: Math.max(0, balance),
    interestPaid,
    paymentsMade,
  };
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
    includeCoveredLossesInAlt,
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
  let coveredLossInvestmentValue = 0;
  let cumulativeCoveredLosses = 0;

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
    CoveredLossInvestment: 0,
    CumulativeCoveredLosses: 0,
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

    if (payoffYear === null && actualLoanBalance <= 0) {
      payoffYear = year;
    }

    const taxableIncome = noi - loanProgress.interestPaid - annualDepreciation;
    const taxEffect = -taxableIncome * (taxRate / 100);
    const afterTaxCashFlow = noi - loanProgress.paymentsMade + taxEffect;

    cumulativeCashFlow += afterTaxCashFlow;
    reinvestedPositiveCashFlow *= 1 + alternateInvestmentReturn / 100;
    coveredLossInvestmentValue *= 1 + alternateInvestmentReturn / 100;

    if (afterTaxCashFlow > 0) {
      if (cashFlowStrategy === "paydown") {
        const extraPrincipal = Math.min(afterTaxCashFlow, actualLoanBalance);
        actualLoanBalance -= extraPrincipal;
        payoffContribution += extraPrincipal;

        if (payoffYear === null && actualLoanBalance <= 0) {
          payoffYear = year;
        }

        const surplusAfterPayoff = afterTaxCashFlow - extraPrincipal;
        reinvestedPositiveCashFlow += surplusAfterPayoff;
      } else {
        reinvestedPositiveCashFlow += afterTaxCashFlow;
      }
    } else {
      cumulativeNegativeCashFlow += afterTaxCashFlow;
      if (includeCoveredLossesInAlt) {
        const coveredLoss = Math.abs(afterTaxCashFlow);
        cumulativeCoveredLosses += coveredLoss;
        coveredLossInvestmentValue += coveredLoss;
      }
    }

    const loanBalance = actualLoanBalance;
    const sellingCost = currentValue * (sellingCostPct / 100);
    const equityAfterSale = currentValue - loanBalance - sellingCost;
    const strategyCashFlowValue = cashFlowStrategy === "paydown" ? payoffContribution : reinvestedPositiveCashFlow;
    const investorValue = equityAfterSale + reinvestedPositiveCashFlow + cumulativeNegativeCashFlow;
    const downPaymentInvestment = downPayment * Math.pow(1 + alternateInvestmentReturn / 100, year) + coveredLossInvestmentValue;
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
      CoveredLossInvestment: Math.round(coveredLossInvestmentValue),
      CumulativeCoveredLosses: Math.round(cumulativeCoveredLosses),
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
  const annualizedReturn =
    initialCash > 0 && final.InvestorValue > 0
      ? (Math.pow(final.InvestorValue / initialCash, 1 / Math.max(1, horizonYears)) - 1) * 100
      : 0;
  const alternateInvestmentGain = final.DownPaymentInvestment - downPayment - cumulativeCoveredLosses;
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
    coveredLossInvestmentValue: final.CoveredLossInvestment,
    cumulativeCoveredLosses,
    strategyLabel,
    payoffYear,
  };
}
