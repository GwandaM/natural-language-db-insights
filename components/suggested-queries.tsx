import { motion } from "framer-motion";
import { Button } from "./ui/button";

export const SuggestedQueries = ({
  handleSuggestionClick,
}: {
  handleSuggestionClick: (suggestion: string) => void;
}) => {
  const suggestionQueries = [
    { desktop: "Who are my top 10 clients by total policy value?",              mobile: "Top clients" },
    { desktop: "Which funds have the best Sharpe ratio over 3 years?",          mobile: "Best Sharpe" },
    { desktop: "Show total book value by ASISA category",                       mobile: "AUM by category" },
    { desktop: "Compare 1Y returns across funds in SA Equity General",          mobile: "1Y returns" },
    { desktop: "Which clients hold funds in the bottom quartile over 1 year?",  mobile: "Bottom quartile" },
    { desktop: "Show average IRR by risk profile",                              mobile: "IRR by risk" },
    { desktop: "What is the product distribution across all policies?",         mobile: "Products" },
    { desktop: "Show 1Y estimated net flows by peer group",                     mobile: "Fund flows" },
    { desktop: "List policies with drawdown rate above 5%",                     mobile: "High drawdown" },
    { desktop: "Compare risk vs return for all funds over 1 year",              mobile: "Risk vs return" },
    { desktop: "Which peer groups have the highest average Morningstar rating?", mobile: "Top peer groups" },
  ];

  return (
    <motion.div
      key="suggestions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      layout
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto"
    >
      <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
        Try these queries:
      </h2>
      <div className="flex flex-wrap gap-2">
        {suggestionQueries.map((suggestion, index) => (
          <Button
            key={index}
            className={index > 5 ? "hidden sm:inline-block" : ""}
            type="button"
            variant="outline"
            onClick={() => handleSuggestionClick(suggestion.desktop)}
          >
            <span className="sm:hidden">{suggestion.mobile}</span>
            <span className="hidden sm:inline">{suggestion.desktop}</span>
          </Button>
        ))}
      </div>
    </motion.div>
  );
};
