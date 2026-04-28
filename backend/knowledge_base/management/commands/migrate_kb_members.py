from django.core.management.base import BaseCommand
from knowledge_base.mongodb_models import KnowledgeBase, KnowledgeBaseMember
from users.mongodb_models import User

class Command(BaseCommand):
    help = 'Migrates the members field of existing KnowledgeBase documents to the new EmbeddedDocument format.'

    def handle(self, *args, **options):
        self.stdout.write('Starting knowledge base member migration...')
        migrated_count = 0
        skipped_count = 0

        for kb in KnowledgeBase.objects.all():
            # Check if migration is needed for this document
            if kb.members and all(isinstance(m, User) for m in kb.members):
                self.stdout.write(f'Migrating Knowledge Base: {kb.name} ({kb.id})')
                new_members = []
                
                # 1. Add the owner as a member with 'owner' role
                if not any(str(member.id) == str(kb.owner.id) for member in kb.members):
                    new_members.append(KnowledgeBaseMember(user=kb.owner, role='owner'))
                    self.stdout.write(f'  - Added owner {kb.owner.username} with role "owner"')
                
                # 2. Migrate existing members with a default role (e.g., 'editor')
                for user in kb.members:
                    # Ensure we don't re-add the owner
                    if str(user.id) == str(kb.owner.id):
                        # If owner was in old list, ensure their role is set to owner
                        owner_member = next((m for m in new_members if str(m.user.id) == str(user.id)), None)
                        if owner_member:
                            owner_member.role = 'owner'
                        continue

                    new_members.append(KnowledgeBaseMember(user=user, role='editor'))
                    self.stdout.write(f'  - Migrated member {user.username} with default role "editor"')
                
                # 3. Update the document
                kb.members = new_members
                kb.save()
                migrated_count += 1
            else:
                # This document is either new, already migrated, or has no members
                skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Migration complete. Migrated: {migrated_count}, Skipped: {skipped_count}.'
        ))
