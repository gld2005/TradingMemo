import { Card } from './Card';

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <Card className="empty-state">
      <div className="empty-state__mark" aria-hidden="true">
        <span />
      </div>
      <p>{message}</p>
    </Card>
  );
}
