<?php
/**
 * ScenarioFolderType
 *
 * Basic form for managing folders hierarchy.
 */
namespace App\Form;

use App\Entity\ScenarioFolder;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;

class ScenarioFolderType extends AbstractType
{
    /** Build folder fields */
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class)
            ->add('parent', EntityType::class, [
                'class' => ScenarioFolder::class,
                'required' => false,
                'placeholder' => 'Aucun (racine)',
                'choice_label' => 'name',
            ]);
    }

    /** Configure default options */
    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => ScenarioFolder::class]);
    }
}
