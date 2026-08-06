"use client";

import React from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = "md",
  className = "",
}) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 !== 0;
  const emptyStars = maxRating - fullStars - (halfStar ? 1 : 0);

  const starSize = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  }[size];

  return (
    <div className={`flex items-center ${className}`}>
      {[...Array(fullStars)].map((_, i) => (
        <Star
          key={`full-${i}`}
          className={`${starSize} text-yellow-400`}
          fill="currentColor"
        />
      ))}
      {halfStar && (
        <Star
          key="half"
          className={`${starSize} text-yellow-400`}
          fill="currentColor"
          fillOpacity={0.5}
        />
      )}
      {[...Array(emptyStars < 0 ? 0 : emptyStars)].map((_, i) => (
        <Star
          key={`empty-${i}`}
          className={`${starSize} text-gray-300`}
          fill="currentColor"
        />
      ))}
    </div>
  );
};
