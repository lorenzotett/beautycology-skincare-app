import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SessionWithMessages } from "@shared/schema";
import { Calendar, Clock, MessageSquare, User, Eye, Copy, Trash2, ChevronRight } from "lucide-react";

interface SessionListItemProps {
  session: SessionWithMessages;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onSelect?: (sessionId: string) => void;
  onView?: (session: SessionWithMessages) => void;
  onCopy?: (text: string, label: string) => void;
  onDelete?: (sessionId: string, userName: string) => void;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
}

export const SessionListItem = memo(function SessionListItem({
  session,
  isSelected,
  isSelectionMode,
  onSelect,
  onView,
  onCopy,
  onDelete,
  formatDate,
  formatTime,
}: SessionListItemProps) {
  return (
    <Card 
      key={session.sessionId}
      className={`bg-white hover:shadow-md transition-all duration-200 cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={() => !isSelectionMode && onView?.(session)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-2">
              {isSelectionMode && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelect?.(session.sessionId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              )}
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-semibold text-gray-900">{session.userName}</span>
              </div>
              {/* Status badges based on user requirements */}
              {session.klaviyoSynced && (
                <Badge className="bg-purple-100 text-purple-800">
                  Klaviyo
                </Badge>
              )}
              {session.googleSheetsSynced && (
                <Badge className="bg-green-100 text-green-800">
                  Sheets
                </Badge>
              )}
              {session.finalButtonClicked && (
                <Badge className="bg-pink-100 text-pink-800">
                  Cream Access
                </Badge>
              )}
              {session.whatsappButtonClicked && (
                <Badge className="bg-blue-100 text-blue-800">
                  WhatsApp
                </Badge>
              )}
              {session.hasImages && (
                <Badge className="bg-yellow-100 text-yellow-800">
                  Immagini
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(session.createdAt)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(session.createdAt)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageSquare className="h-3 w-3" />
                <span>{session.messageCount} messaggi</span>
              </div>
              {session.userEmail && (
                <div className="flex items-center space-x-1">
                  <span className="text-gray-500">Email:</span>
                  <span className="font-medium">{session.userEmail}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isSelectionMode && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView?.(session);
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy?.(session.sessionId, "Session ID");
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(session.sessionId, session.userName);
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {!isSelectionMode && (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});