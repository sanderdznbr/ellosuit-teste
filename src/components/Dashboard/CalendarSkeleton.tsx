
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const CalendarSkeleton = () => {
  return (
    <Card className="shadow-lg border-0 rounded-3xl overflow-hidden">
      <CardContent className="p-6">
        {/* Calendar grid skeleton */}
        <div className="space-y-4">
          {/* Header skeleton */}
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            </div>
            <div className="flex space-x-2">
              <div className="h-8 bg-gray-200 rounded w-20 animate-pulse" />
              <div className="h-8 bg-gray-200 rounded w-20 animate-pulse" />
              <div className="h-8 bg-gray-200 rounded w-20 animate-pulse" />
            </div>
          </div>

          {/* Days of week skeleton */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>

          {/* Calendar days skeleton */}
          {Array.from({ length: 5 }).map((_, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, dayIndex) => (
                <div key={dayIndex} className="space-y-2">
                  <div className="h-16 bg-gray-100 rounded-lg border border-gray-200 p-2">
                    <div className="h-4 bg-gray-200 rounded w-6 animate-pulse mb-2" />
                    {Math.random() > 0.7 && (
                      <div className="h-2 bg-[#B3BFF0] rounded animate-pulse" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarSkeleton;
