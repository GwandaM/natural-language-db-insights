import { motion } from "framer-motion";
import { Button } from "./ui/button";

export const SuggestedQueries = ({
  handleSuggestionClick,
}: {
  handleSuggestionClick: (suggestion: string) => void;
}) => {
  const suggestionQueries = [
    { desktop: "Who are my top 10 clients by total portfolio value?",            mobile: "Top clients" },
    { desktop: "Which funds have the best Sharpe ratio over 3 years?",           mobile: "Best Sharpe" },
    { desktop: "Show AUM breakdown by advisor",                                  mobile: "AUM by advisor" },
    { desktop: "Compare 1Y returns across SA Equity funds",                      mobile: "1Y returns" },
    { desktop: "Which clients hold funds in the bottom quartile?",               mobile: "Bottom quartile" },
    { desktop: "Show transaction activity over the last 6 months",               mobile: "Transactions" },
    { desktop: "What is the policy type distribution across all clients?",       mobile: "Policy types" },
    { desktop: "Show net fund flows by peer group",                              mobile: "Fund flows" },
    { desktop: "List dormant clients with their total portfolio value",          mobile: "Dormant clients" },
    { desktop: "Compare risk vs return for all funds over 1 year",              mobile: "Risk vs return" },
    { desktop: "Which advisors manage the most AUM?",                            mobile: "Top advisors" },
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
