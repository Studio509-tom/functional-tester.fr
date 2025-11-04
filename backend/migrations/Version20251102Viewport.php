<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251102Viewport extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add viewportWidth and viewportHeight to test_scenario';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        if (!$schema->hasTable('test_scenario')) {
            return; // safety guard in case schema is not initialized
        }
        $table = $schema->getTable('test_scenario');
        if (!$table->hasColumn('viewport_width')) {
            $this->addSql('ALTER TABLE test_scenario ADD viewport_width INT DEFAULT NULL');
        }
        if (!$table->hasColumn('viewport_height')) {
            $this->addSql('ALTER TABLE test_scenario ADD viewport_height INT DEFAULT NULL');
        }
    }

    public function down(Schema $schema): void
    {
        if ($schema->hasTable('test_scenario')) {
            $table = $schema->getTable('test_scenario');
            if ($table->hasColumn('viewport_width')) {
                $this->addSql('ALTER TABLE test_scenario DROP viewport_width');
            }
            if ($table->hasColumn('viewport_height')) {
                $this->addSql('ALTER TABLE test_scenario DROP viewport_height');
            }
        }
    }
}
